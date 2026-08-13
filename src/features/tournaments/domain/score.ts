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
