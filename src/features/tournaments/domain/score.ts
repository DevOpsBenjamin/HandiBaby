import type { Match, TableSide } from './types'

/**
 * A match stops when a side reaches ten. The winner's score is therefore never
 * typed, which is what reduces an entry to the winning side and the score the
 * loser stopped at.
 */
export const WINNING_SCORE = 10

/** Every score a loser can end on, in the order the entry pad offers them. */
export const LOSER_SCORES: readonly number[] = Array.from(
  { length: WINNING_SCORE },
  (_, score) => score,
)

export interface MatchResult {
  winningSide: TableSide
  loserScore: number
}

export function isValidLoserScore(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score < WINNING_SCORE
}

/** The result already on a match, or null while it is still to be played. */
export function readResult(match: Match): MatchResult | null {
  if (match.winnerTeamId === null || match.loserScore === null) {
    return null
  }

  return {
    winningSide: match.winnerTeamId === match.blueTeamId ? 'blue' : 'white',
    loserScore: match.loserScore,
  }
}

/** A match with a result, with both sides resolved so nothing downstream re-checks for null. */
export interface PlayedMatch {
  blueTeamId: number
  whiteTeamId: number
  blueDefenderId: number
  blueAttackerId: number
  whiteDefenderId: number
  whiteAttackerId: number
  winnerTeamId: number
  loserTeamId: number
  loserScore: number
}

/**
 * The only matches every derivation is allowed to see.
 *
 * Playoff matches are excluded by rule, not by accident: the playoff is seeded
 * from these numbers, so letting it feed them back would make the seeding
 * depend on itself.
 */
export function playedRoundRobin(matches: readonly Match[]): PlayedMatch[] {
  const played: PlayedMatch[] = []

  for (const match of matches) {
    if (match.phase !== 'round-robin' || match.winnerTeamId === null || match.loserScore === null) {
      continue
    }

    played.push({
      blueTeamId: match.blueTeamId,
      whiteTeamId: match.whiteTeamId,
      blueDefenderId: match.blueDefenderId,
      blueAttackerId: match.blueAttackerId,
      whiteDefenderId: match.whiteDefenderId,
      whiteAttackerId: match.whiteAttackerId,
      winnerTeamId: match.winnerTeamId,
      loserTeamId: match.winnerTeamId === match.blueTeamId ? match.whiteTeamId : match.blueTeamId,
      loserScore: match.loserScore,
    })
  }

  return played
}

/** What a team put in during a match it took part in. */
export function goalsFor(match: PlayedMatch, teamId: number): number {
  return match.winnerTeamId === teamId ? WINNING_SCORE : match.loserScore
}

export function involves(match: PlayedMatch, teamId: number): boolean {
  return match.winnerTeamId === teamId || match.loserTeamId === teamId
}
