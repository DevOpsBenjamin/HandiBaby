import type { HandiBabyDatabase } from '@/core/db/database'
import type { PlayoffPhase } from './domain/bracket'
import type { FrozenConfiguration, FrozenEdition } from './domain/freeze'
import {
  dependents,
  resolveBracket,
  type PlayoffOutcome,
  type ResolvedPairing,
} from './domain/playoff'
import { readResult, type MatchResult } from './domain/score'
import type { Match, TableSide, Tournament } from './domain/types'
import { ScoreKeeper } from './ScoreKeeper'

export class PlayoffNotOpenError extends Error {
  constructor() {
    super('Le playoff de cette édition n’est pas ouvert')
    this.name = 'PlayoffNotOpenError'
  }
}

export class RoundNotReadyError extends Error {
  constructor() {
    super('Ce tour attend le résultat du tour qui l’alimente')
    this.name = 'RoundNotReadyError'
  }
}

/** A result that has already propagated cannot be taken back without unmaking the rest. */
export class RoundLockedError extends Error {
  constructor() {
    super('Ce match est verrouillé : le tour qu’il alimente est déjà saisi')
    this.name = 'RoundLockedError'
  }
}

export interface PlayoffRound extends ResolvedPairing {
  matchId: number | null
  blueTeamId: number | null
  whiteTeamId: number | null
  result: MatchResult | null
  /** Locked because the round it feeds has been entered. */
  locked: boolean
}

export interface PlayoffState {
  frozen: FrozenEdition
  rounds: PlayoffRound[]
}

/**
 * Runs the Page system off the bracket frozen when the group phase closed.
 *
 * Nothing here is recomputed from the round-robin: the seeding, the pairings
 * and the configurations are read back from the freeze, so the playoff cannot
 * be reshaped by anything that happens while it is being played.
 */
export class Playoff {
  constructor(
    private readonly db: HandiBabyDatabase,
    private readonly keeper: ScoreKeeper,
  ) {}

  async read(tournamentId: number): Promise<PlayoffState | null> {
    const frozen = await this.db.frozenEditions.get(tournamentId)

    if (frozen === undefined) {
      return null
    }

    const matches = await this.#playoffMatches(tournamentId)
    const pairings = resolveBracket(frozen.bracket, frozen.standings, this.#outcomes(matches))

    return {
      frozen,
      rounds: pairings.map((pairing) => {
        const match = matches.get(pairing.phase)
        const entered = match === undefined ? null : readResult(match)

        return {
          ...pairing,
          matchId: match?.id ?? null,
          blueTeamId: match?.blueTeamId ?? null,
          whiteTeamId: match?.whiteTeamId ?? null,
          result:
            entered === null || match === undefined
              ? null
              : {
                  winningSide: entered.winningSide,
                  loserScore: entered.loserScore,
                },
          locked: this.#isLocked(frozen, pairing.phase, matches),
        }
      }),
    }
  }

  /**
   * Writes a row for every round whose two sides are known. Idempotent, so it
   * can run on every read: a round becomes playable the moment the round
   * feeding it is entered, and it needs somewhere to hold the end choice before
   * anyone has a score to type.
   */
  async ensureRounds(tournament: Tournament): Promise<void> {
    const tournamentId = tournament.id ?? 0
    const frozen = await this.db.frozenEditions.get(tournamentId)

    if (frozen === undefined || tournament.status !== 'playoff') {
      throw new PlayoffNotOpenError()
    }

    const matches = await this.#playoffMatches(tournamentId)
    const pairings = resolveBracket(frozen.bracket, frozen.standings, this.#outcomes(matches))

    for (const pairing of pairings) {
      if (!pairing.ready || matches.has(pairing.phase)) {
        continue
      }

      const home = pairing.homeTeamId
      const away = pairing.awayTeamId

      if (home === null || away === null) {
        continue
      }

      // The better-ranked team starts on blue; it is the one entitled to move.
      const blue = pairing.choosesEnd === away ? away : home
      const white = blue === home ? away : home

      await this.db.matches.add(this.#buildMatch(tournamentId, pairing.phase, blue, white, frozen))
    }
  }

  /** Puts the privileged team on the end it wants. Only until the match is played. */
  async chooseEnd(tournament: Tournament, phase: PlayoffPhase, end: TableSide): Promise<void> {
    const tournamentId = tournament.id ?? 0
    const frozen = await this.db.frozenEditions.get(tournamentId)

    if (frozen === undefined || tournament.status !== 'playoff') {
      throw new PlayoffNotOpenError()
    }

    const matches = await this.#playoffMatches(tournamentId)
    const match = matches.get(phase)

    if (match === undefined) {
      throw new RoundNotReadyError()
    }

    if (readResult(match) !== null) {
      throw new RoundLockedError()
    }

    const pairing = resolveBracket(frozen.bracket, frozen.standings, this.#outcomes(matches)).find(
      (candidate) => candidate.phase === phase,
    )

    const privileged = pairing?.choosesEnd ?? null
    const alreadyThere = end === 'blue' ? match.blueTeamId : match.whiteTeamId

    if (privileged === null || alreadyThere === privileged) {
      return
    }

    const opponent = match.blueTeamId === privileged ? match.whiteTeamId : match.blueTeamId
    const blue = end === 'blue' ? privileged : opponent
    const white = end === 'blue' ? opponent : privileged

    await this.db.matches.update(match.id ?? 0, {
      ...this.#sides(blue, white, frozen),
    })
  }

  /**
   * Enters or replaces the result of a round. The upstream guard lives here
   * rather than in the score keeper, because it is a rule about the bracket
   * rather than about a match.
   */
  async enter(tournament: Tournament, phase: PlayoffPhase, result: MatchResult): Promise<void> {
    const tournamentId = tournament.id ?? 0
    const frozen = await this.db.frozenEditions.get(tournamentId)

    if (frozen === undefined || tournament.status !== 'playoff') {
      throw new PlayoffNotOpenError()
    }

    const matches = await this.#playoffMatches(tournamentId)
    const match = matches.get(phase)

    if (match === undefined) {
      throw new RoundNotReadyError()
    }

    if (this.#isLocked(frozen, phase, matches)) {
      throw new RoundLockedError()
    }

    const matchId = match.id ?? 0

    if (readResult(match) === null) {
      await this.keeper.record(tournament, matchId, result)
    } else {
      await this.keeper.correct(tournament, matchId, result)
    }

    // A changed winner reshapes everything downstream, so stale rows go first.
    await this.#clearDependents(frozen, phase, tournamentId)
    await this.ensureRounds(tournament)
  }

  async #clearDependents(
    frozen: FrozenEdition,
    phase: PlayoffPhase,
    tournamentId: number,
  ): Promise<void> {
    const matches = await this.#playoffMatches(tournamentId)
    const outcomes = this.#outcomes(matches)
    const pairings = resolveBracket(frozen.bracket, frozen.standings, outcomes)

    for (const downstream of dependents(frozen.bracket, phase)) {
      const match = matches.get(downstream)
      const pairing = pairings.find((candidate) => candidate.phase === downstream)

      if (match === undefined || pairing === undefined) {
        continue
      }

      const stillRight =
        pairing.homeTeamId !== null &&
        pairing.awayTeamId !== null &&
        [pairing.homeTeamId, pairing.awayTeamId].every((teamId) =>
          [match.blueTeamId, match.whiteTeamId].includes(teamId),
        )

      if (!stillRight) {
        await this.db.matches.delete(match.id ?? 0)
        await this.#clearDependents(frozen, downstream, tournamentId)
      }
    }
  }

  #isLocked(
    frozen: FrozenEdition,
    phase: PlayoffPhase,
    matches: ReadonlyMap<PlayoffPhase, Match>,
  ): boolean {
    return dependents(frozen.bracket, phase).some((downstream) => {
      const match = matches.get(downstream)
      return match !== undefined && readResult(match) !== null
    })
  }

  #outcomes(matches: ReadonlyMap<PlayoffPhase, Match>): Map<PlayoffPhase, PlayoffOutcome> {
    const outcomes = new Map<PlayoffPhase, PlayoffOutcome>()

    for (const [phase, match] of matches) {
      if (match.winnerTeamId === null) {
        continue
      }

      outcomes.set(phase, {
        winnerTeamId: match.winnerTeamId,
        loserTeamId: match.winnerTeamId === match.blueTeamId ? match.whiteTeamId : match.blueTeamId,
      })
    }

    return outcomes
  }

  async #playoffMatches(tournamentId: number): Promise<Map<PlayoffPhase, Match>> {
    const rows = await this.db.matches.where('tournamentId').equals(tournamentId).toArray()
    const matches = new Map<PlayoffPhase, Match>()

    for (const row of rows) {
      if (row.phase !== 'round-robin' && row.phase !== 'tiebreak') {
        matches.set(row.phase, row)
      }
    }

    return matches
  }

  #buildMatch(
    tournamentId: number,
    phase: PlayoffPhase,
    blue: number,
    white: number,
    frozen: FrozenEdition,
  ): Match {
    return {
      tournamentId,
      phase,
      duel: null,
      rankInDuel: null,
      ...this.#sides(blue, white, frozen),
      winnerTeamId: null,
      loserScore: null,
      enteredAt: null,
    }
  }

  /** Each team stands the way it was frozen at validation, not the way it feels today. */
  #sides(blue: number, white: number, frozen: FrozenEdition) {
    const posts = (teamId: number): FrozenConfiguration =>
      frozen.configurations.find((row) => row.teamId === teamId) ?? {
        teamId,
        defenderId: 0,
        attackerId: 0,
        chosen: false,
      }

    const blueposts = posts(blue)
    const whiteposts = posts(white)

    return {
      blueTeamId: blue,
      whiteTeamId: white,
      blueDefenderId: blueposts.defenderId,
      blueAttackerId: blueposts.attackerId,
      whiteDefenderId: whiteposts.defenderId,
      whiteAttackerId: whiteposts.attackerId,
    }
  }
}
