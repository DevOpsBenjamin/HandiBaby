import type { BracketPairing, BracketSource, PlayoffPhase } from './bracket'
import type { FrozenStanding } from './freeze'

export interface PlayoffOutcome {
  winnerTeamId: number
  loserTeamId: number
}

export type PlayoffResults = ReadonlyMap<PlayoffPhase, PlayoffOutcome>

export interface ResolvedPairing {
  phase: PlayoffPhase
  homeTeamId: number | null
  awayTeamId: number | null
  /** Both sides known, so the round can be put on the table. */
  ready: boolean
  /**
   * The better-ranked of the two, which picks its end of the table. Over the
   * whole tournament the standings are the only thing handing out privileges.
   */
  choosesEnd: number | null
}

function rankOf(teamId: number, standings: readonly FrozenStanding[]): number {
  return standings.find((row) => row.teamId === teamId)?.rank ?? Number.MAX_SAFE_INTEGER
}

function resolve(
  source: BracketSource,
  standings: readonly FrozenStanding[],
  results: PlayoffResults,
): number | null {
  if (source.from === 'seed') {
    return standings.find((row) => row.rank === source.rank)?.teamId ?? null
  }

  const outcome = results.get(source.of)

  if (outcome === undefined) {
    return null
  }

  return source.from === 'winner' ? outcome.winnerTeamId : outcome.loserTeamId
}

/**
 * Turns the frozen bracket into actual pairings, as far as the results so far
 * allow. A round whose sides are not both known yet is simply not ready, which
 * is what keeps the next round shut until the one before it has been played.
 */
export function resolveBracket(
  bracket: readonly BracketPairing[],
  standings: readonly FrozenStanding[],
  results: PlayoffResults,
): ResolvedPairing[] {
  return bracket.map((pairing) => {
    const homeTeamId = resolve(pairing.home, standings, results)
    const awayTeamId = resolve(pairing.away, standings, results)

    if (homeTeamId === null || awayTeamId === null) {
      return { phase: pairing.phase, homeTeamId, awayTeamId, ready: false, choosesEnd: null }
    }

    return {
      phase: pairing.phase,
      homeTeamId,
      awayTeamId,
      ready: true,
      choosesEnd:
        rankOf(homeTeamId, standings) <= rankOf(awayTeamId, standings) ? homeTeamId : awayTeamId,
    }
  })
}

/**
 * The rounds a given round feeds.
 *
 * Entering one of them is what locks the round upstream: a wrong winner can be
 * fixed right up until it has propagated, which is the same protection a
 * confirmation step would give without a second click on every match.
 */
export function dependents(
  bracket: readonly BracketPairing[],
  phase: PlayoffPhase,
): PlayoffPhase[] {
  return bracket
    .filter((pairing) =>
      [pairing.home, pairing.away].some((source) => source.from !== 'seed' && source.of === phase),
    )
    .map((pairing) => pairing.phase)
}
