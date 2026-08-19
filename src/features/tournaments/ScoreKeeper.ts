import type { HandiBabyDatabase } from '@/core/db/database'
import type { JournalOperation } from './domain/journal'
import { isValidLoserScore, readResult, WINNING_SCORE, type MatchResult } from './domain/score'
import { SIDE_LABELS, type MatchPhase, type TableSide, type Tournament } from './domain/types'

/** Registered by the Supabase score adapter once a server exists. */
export const SCORE_ADAPTER = 'tournament-scores'

/** One server function per operation, so each keeps its own precondition. */
export const SCORE_OPERATIONS: Record<JournalOperation, string> = {
  record: 'record-score',
  correct: 'correct-score',
}

export class UnknownMatchError extends Error {
  constructor() {
    super('Ce match est introuvable dans cette édition')
    this.name = 'UnknownMatchError'
  }
}

export class InvalidLoserScoreError extends Error {
  constructor() {
    super(`Le score du perdant va de 0 à ${WINNING_SCORE - 1}`)
    this.name = 'InvalidLoserScoreError'
  }
}

/**
 * Carries the result that is already there rather than only refusing. The
 * caller's own read of the match may predate whatever arrived from another
 * device, so this is the value worth showing.
 */
export class MatchAlreadyEnteredError extends Error {
  constructor(readonly existing: MatchResult) {
    super(
      `Ce match a déjà un résultat : ${SIDE_LABELS[existing.winningSide]} ` +
        `${WINNING_SCORE} – ${existing.loserScore}`,
    )
    this.name = 'MatchAlreadyEnteredError'
  }
}

export class MatchNotEnteredError extends Error {
  constructor() {
    super('Ce match n’a pas encore de résultat à corriger')
    this.name = 'MatchNotEnteredError'
  }
}

/**
 * The group phase was closed, and the playoff is seeded from what it read.
 * Editing a round-robin match now would invalidate matches already played, so
 * it is refused here rather than reopened anywhere.
 */
export class GroupPhaseClosedError extends Error {
  constructor() {
    super('La phase de classement est validée : ce match n’est plus modifiable')
    this.name = 'GroupPhaseClosedError'
  }
}

/**
 * What a server needs to replay the write. Local row ids differ from one device
 * to the next, so the match is designated by where it sits in the calendar, the
 * winner by its side of the table, and the write itself by its journal line.
 */
export interface ScoreWritePayload {
  journalEntryId: string
  tournamentPublicId: string
  phase: MatchPhase
  duel: number | null
  rankInDuel: number | null
  winningSide: TableSide
  loserScore: number
  /** What the match read before this write, so the server can refuse a stale correction. */
  previous: MatchResult | null
  writtenAt: number
}

/** The slice of the sync engine this service needs: queue a write, nothing else. */
export interface WriteQueue {
  enqueue<TPayload>(entry: { adapter: string; operation: string; payload: TPayload }): Promise<void>
}

/**
 * Writes results onto matches, and the history of having done so.
 *
 * Recording and correcting are two operations rather than one upsert, so that a
 * second scorekeeper entering the same match offline is told what is already
 * there instead of silently replacing what someone else saw happen. Two
 * different results for one match mean somebody is mistaken, which is worth
 * surfacing rather than resolving by whoever syncs last.
 */
export class ScoreKeeper {
  constructor(
    private readonly db: HandiBabyDatabase,
    private readonly queue: WriteQueue,
  ) {}

  /** Applies only to a match with no result. */
  async record(tournament: Tournament, matchId: number, result: MatchResult): Promise<void> {
    await this.#write('record', tournament, matchId, result)
  }

  /** Applies only to a match that has one, and keeps what it replaced. */
  async correct(tournament: Tournament, matchId: number, result: MatchResult): Promise<void> {
    await this.#write('correct', tournament, matchId, result)
  }

  async #write(
    operation: JournalOperation,
    tournament: Tournament,
    matchId: number,
    result: MatchResult,
  ): Promise<void> {
    if (!isValidLoserScore(result.loserScore)) {
      throw new InvalidLoserScoreError()
    }

    const payload = await this.db.transaction(
      'rw',
      [this.db.tournaments, this.db.matches, this.db.journal],
      async () => {
        const match = await this.db.matches.get(matchId)

        if (match === undefined || match.tournamentId !== tournament.id) {
          throw new UnknownMatchError()
        }

        // Read the status rather than trusting the caller's copy, which may
        // predate a freeze that happened on another screen or another device.
        const current = await this.db.tournaments.get(match.tournamentId)

        if (match.phase === 'round-robin' && current?.status !== 'round-robin') {
          throw new GroupPhaseClosedError()
        }

        const previous = readResult(match)

        if (operation === 'record' && previous !== null) {
          throw new MatchAlreadyEnteredError(previous)
        }

        if (operation === 'correct' && previous === null) {
          throw new MatchNotEnteredError()
        }

        const writtenAt = Date.now()
        const entryId = crypto.randomUUID()

        await this.db.matches.update(matchId, {
          winnerTeamId: result.winningSide === 'blue' ? match.blueTeamId : match.whiteTeamId,
          loserScore: result.loserScore,
          enteredAt: writtenAt,
        })

        // Same transaction as the write it describes: a history that can drift
        // from the data explains nothing.
        await this.db.journal.add({
          entryId,
          tournamentId: match.tournamentId,
          matchId,
          operation,
          previous,
          next: result,
          writtenAt,
        })

        return {
          journalEntryId: entryId,
          tournamentPublicId: tournament.publicId,
          phase: match.phase,
          duel: match.duel,
          rankInDuel: match.rankInDuel,
          winningSide: result.winningSide,
          loserScore: result.loserScore,
          previous,
          writtenAt,
        } satisfies ScoreWritePayload
      },
    )

    // Outside the transaction: the outbox belongs to the sync engine, which
    // refreshes the pending count as it queues.
    await this.queue.enqueue({
      adapter: SCORE_ADAPTER,
      operation: SCORE_OPERATIONS[operation],
      payload,
    })
  }

  /**
   * Inverts table sides (blue/white) for a round-robin match, and automatically
   * balances the duel by inverting a corresponding unplayed match in the same duel.
   */
  async invertSides(
    tournament: Tournament,
    matchId: number,
  ): Promise<{ balancedMatchId: number | null; balancedMatchOrder: number | null }> {
    return await this.db.transaction('rw', [this.db.tournaments, this.db.matches], async () => {
      const match = await this.db.matches.get(matchId)

      if (match === undefined || match.tournamentId !== tournament.id) {
        throw new UnknownMatchError()
      }

      const current = await this.db.tournaments.get(match.tournamentId)

      if (match.phase !== 'round-robin' || current?.status !== 'round-robin') {
        throw new GroupPhaseClosedError()
      }

      const oldBlueTeamId = match.blueTeamId
      const oldWhiteTeamId = match.whiteTeamId
      const oldBlueDefenderId = match.blueDefenderId
      const oldBlueAttackerId = match.blueAttackerId
      const oldWhiteDefenderId = match.whiteDefenderId
      const oldWhiteAttackerId = match.whiteAttackerId

      await this.db.matches.update(matchId, {
        blueTeamId: oldWhiteTeamId,
        whiteTeamId: oldBlueTeamId,
        blueDefenderId: oldWhiteDefenderId,
        blueAttackerId: oldWhiteAttackerId,
        whiteDefenderId: oldBlueDefenderId,
        whiteAttackerId: oldBlueAttackerId,
      })

      let balancedMatchId: number | null = null
      let balancedMatchOrder: number | null = null

      if (match.duel !== null && tournament.id !== undefined) {
        const duelMatches = await this.db.matches
          .where('tournamentId')
          .equals(tournament.id)
          .filter((m) => m.phase === 'round-robin' && m.duel === match.duel && m.id !== matchId)
          .toArray()

        const unplayedCandidate = duelMatches.find(
          (m) => m.winnerTeamId === null && m.blueTeamId === oldWhiteTeamId,
        )

        if (unplayedCandidate !== undefined && unplayedCandidate.id !== undefined) {
          balancedMatchId = unplayedCandidate.id
          balancedMatchOrder = (unplayedCandidate.order ?? 0) + 1

          await this.db.matches.update(unplayedCandidate.id, {
            blueTeamId: unplayedCandidate.whiteTeamId,
            whiteTeamId: unplayedCandidate.blueTeamId,
            blueDefenderId: unplayedCandidate.whiteDefenderId,
            blueAttackerId: unplayedCandidate.whiteAttackerId,
            whiteDefenderId: unplayedCandidate.blueDefenderId,
            whiteAttackerId: unplayedCandidate.blueAttackerId,
          })
        }
      }

      return { balancedMatchId, balancedMatchOrder }
    })
  }
}
