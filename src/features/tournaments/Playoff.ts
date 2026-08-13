import type { HandiBabyDatabase } from '@/core/db/database'
import type { PlayoffPhase } from './domain/bracket'
import type { FrozenConfiguration, FrozenEdition } from './domain/freeze'
import { resolveBracket, type PlayoffOutcome, type ResolvedPairing } from './domain/playoff'
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
    super('Ce tour attend la validation du tour qui l’alimente')
    this.name = 'RoundNotReadyError'
  }
}

/** Confirmed results are what the rest of the bracket is built on. */
export class RoundValidatedError extends Error {
  constructor() {
    super('Ce match est validé : son résultat n’est plus modifiable')
    this.name = 'RoundValidatedError'
  }
}

export class NoResultToValidateError extends Error {
  constructor() {
    super('Ce match n’a pas encore de résultat à valider')
    this.name = 'NoResultToValidateError'
  }
}

export interface PlayoffRound extends ResolvedPairing {
  matchId: number | null
  blueTeamId: number | null
  whiteTeamId: number | null
  result: MatchResult | null
  validated: boolean
  /** A result is in and nobody has confirmed it yet: the round is waiting on a decision. */
  awaitingValidation: boolean
  /** The last round of the bracket, whose validation ends the edition. */
  decisive: boolean
}

export interface PlayoffState {
  frozen: FrozenEdition
  rounds: PlayoffRound[]
}

/**
 * Runs the Page system off the bracket frozen when the group phase closed.
 *
 * Nothing here is recomputed from the round-robin: the seeding, the pairings and
 * the configurations are read back from the freeze, so the playoff cannot be
 * reshaped by anything that happens while it is being played.
 *
 * Each round is confirmed by hand. A typed result stays freely correctable until
 * then, and confirming is what opens the round it feeds, so a wrong winner can
 * never propagate before somebody looked at it.
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
    const last = frozen.bracket[frozen.bracket.length - 1]?.phase

    return {
      frozen,
      rounds: pairings.map((pairing) => {
        const match = matches.get(pairing.phase)
        const result = match === undefined ? null : readResult(match)
        const validated = match?.validatedAt != null

        return {
          ...pairing,
          matchId: match?.id ?? null,
          blueTeamId: match?.blueTeamId ?? null,
          whiteTeamId: match?.whiteTeamId ?? null,
          result,
          validated,
          awaitingValidation: result !== null && !validated,
          decisive: pairing.phase === last,
        }
      }),
    }
  }

  /**
   * Writes a row for every round whose two sides are settled. Idempotent, so it
   * can run on every read: a round needs somewhere to hold its end choice before
   * anyone has a score to type.
   */
  async ensureRounds(tournament: Tournament): Promise<void> {
    const tournamentId = tournament.id ?? 0
    const frozen = await this.#requireFrozen(tournament)
    const matches = await this.#playoffMatches(tournamentId)
    const pairings = resolveBracket(frozen.bracket, frozen.standings, this.#outcomes(matches))

    for (const pairing of pairings) {
      const home = pairing.homeTeamId
      const away = pairing.awayTeamId

      if (!pairing.ready || matches.has(pairing.phase) || home === null || away === null) {
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
    const frozen = await this.#requireFrozen(tournament)
    const matches = await this.#playoffMatches(tournamentId)
    const match = matches.get(phase)

    if (match === undefined) {
      throw new RoundNotReadyError()
    }

    if (readResult(match) !== null) {
      throw new RoundValidatedError()
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

    await this.db.matches.update(match.id ?? 0, this.#sides(blue, white, frozen))
  }

  /** Enters or replaces the result of a round. Refused once the round is confirmed. */
  async enter(tournament: Tournament, phase: PlayoffPhase, result: MatchResult): Promise<void> {
    await this.#requireFrozen(tournament)

    const matches = await this.#playoffMatches(tournament.id ?? 0)
    const match = matches.get(phase)

    if (match === undefined) {
      throw new RoundNotReadyError()
    }

    if (match.validatedAt != null) {
      throw new RoundValidatedError()
    }

    const matchId = match.id ?? 0

    if (readResult(match) === null) {
      await this.keeper.record(tournament, matchId, result)
    } else {
      await this.keeper.correct(tournament, matchId, result)
    }
  }

  /**
   * Confirms a round: locks its result and opens the round it feeds.
   *
   * Deliberately a separate act from typing the score. The score is typed at the
   * table, often by whoever is nearest; opening the next round is a decision
   * that the four people standing there have agreed on the result.
   */
  async validate(tournament: Tournament, phase: PlayoffPhase): Promise<void> {
    const tournamentId = tournament.id ?? 0
    const frozen = await this.#requireFrozen(tournament)
    const matches = await this.#playoffMatches(tournamentId)
    const match = matches.get(phase)

    if (match === undefined) {
      throw new RoundNotReadyError()
    }

    if (readResult(match) === null) {
      throw new NoResultToValidateError()
    }

    if (match.validatedAt != null) {
      throw new RoundValidatedError()
    }

    await this.db.matches.update(match.id ?? 0, { validatedAt: Date.now() })
    await this.ensureRounds(tournament)

    // Confirming the last round is what ends the edition: there is nothing left
    // for it to open.
    if (phase === frozen.bracket[frozen.bracket.length - 1]?.phase) {
      await this.db.tournaments.update(tournamentId, { status: 'finished' })
    }
  }

  async #requireFrozen(tournament: Tournament): Promise<FrozenEdition> {
    const frozen = await this.db.frozenEditions.get(tournament.id ?? 0)
    const current = await this.db.tournaments.get(tournament.id ?? 0)

    if (frozen === undefined || current?.status !== 'playoff') {
      throw new PlayoffNotOpenError()
    }

    return frozen
  }

  /** Only confirmed results seed anything: an unconfirmed one opens no round. */
  #outcomes(matches: ReadonlyMap<PlayoffPhase, Match>): Map<PlayoffPhase, PlayoffOutcome> {
    const outcomes = new Map<PlayoffPhase, PlayoffOutcome>()

    for (const [phase, match] of matches) {
      if (match.winnerTeamId === null || match.validatedAt == null) {
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
      validatedAt: null,
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

    const bluePosts = posts(blue)
    const whitePosts = posts(white)

    return {
      blueTeamId: blue,
      whiteTeamId: white,
      blueDefenderId: bluePosts.defenderId,
      blueAttackerId: bluePosts.attackerId,
      whiteDefenderId: whitePosts.defenderId,
      whiteAttackerId: whitePosts.attackerId,
    }
  }
}
