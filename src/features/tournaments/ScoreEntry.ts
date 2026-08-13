import type { HandiBabyDatabase } from '@/core/db/database'
import { isValidLoserScore, readResult, WINNING_SCORE, type MatchResult } from './domain/score'
import { SIDE_LABELS, type MatchPhase, type TableSide, type Tournament } from './domain/types'

/** Registered by the Supabase score adapter once a server exists. */
export const SCORE_ADAPTER = 'tournament-scores'
export const RECORD_SCORE_OPERATION = 'record-score'

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

/**
 * What a server needs to replay the entry. Local row ids differ from one device
 * to the next, so the match is designated by where it sits in the calendar and
 * the winner by its side of the table.
 */
export interface RecordScorePayload {
  tournamentPublicId: string
  phase: MatchPhase
  duel: number | null
  rankInDuel: number | null
  winningSide: TableSide
  loserScore: number
  enteredAt: number
}

/** The slice of the sync engine this service needs: queue a write, nothing else. */
export interface WriteQueue {
  enqueue<TPayload>(entry: { adapter: string; operation: string; payload: TPayload }): Promise<void>
}

/**
 * Records a result on a match that has none.
 *
 * Recording and correcting are two operations rather than one upsert, so that a
 * second scorekeeper entering the same match offline is told what is already
 * there instead of silently replacing what someone else saw happen.
 */
export class ScoreEntry {
  constructor(
    private readonly db: HandiBabyDatabase,
    private readonly queue: WriteQueue,
  ) {}

  async record(tournament: Tournament, matchId: number, result: MatchResult): Promise<void> {
    if (!isValidLoserScore(result.loserScore)) {
      throw new InvalidLoserScoreError()
    }

    const payload = await this.db.transaction('rw', this.db.matches, async () => {
      const match = await this.db.matches.get(matchId)

      if (match === undefined || match.tournamentId !== tournament.id) {
        throw new UnknownMatchError()
      }

      const existing = readResult(match)

      if (existing !== null) {
        throw new MatchAlreadyEnteredError(existing)
      }

      const enteredAt = Date.now()

      await this.db.matches.update(matchId, {
        winnerTeamId: result.winningSide === 'blue' ? match.blueTeamId : match.whiteTeamId,
        loserScore: result.loserScore,
        enteredAt,
      })

      return {
        tournamentPublicId: tournament.publicId,
        phase: match.phase,
        duel: match.duel,
        rankInDuel: match.rankInDuel,
        winningSide: result.winningSide,
        loserScore: result.loserScore,
        enteredAt,
      } satisfies RecordScorePayload
    })

    // Outside the transaction: the outbox belongs to the sync engine, which
    // refreshes the pending count as it queues.
    await this.queue.enqueue({
      adapter: SCORE_ADAPTER,
      operation: RECORD_SCORE_OPERATION,
      payload,
    })
  }
}
