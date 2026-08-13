import type { MatchPhase } from './types'

export type PlayoffPhase = Extract<
  MatchPhase,
  'qualification' | 'elimination' | 'semi-final' | 'final'
>

/**
 * Where a playoff side comes from. Seeds are known the moment the group phase
 * freezes; the rest only once the round they depend on has been played.
 */
export type BracketSource =
  | { from: 'seed'; rank: number }
  | { from: 'winner'; of: PlayoffPhase }
  | { from: 'loser'; of: PlayoffPhase }

export interface BracketPairing {
  phase: PlayoffPhase
  home: BracketSource
  away: BracketSource
}

export class UnsupportedTeamCountError extends Error {
  constructor(count: number) {
    super(`Un playoff se joue à trois ou quatre équipes, pas ${count}`)
    this.name = 'UnsupportedTeamCountError'
  }
}

const seed = (rank: number): BracketSource => ({ from: 'seed', rank })
const winner = (of: PlayoffPhase): BracketSource => ({ from: 'winner', of })
const loser = (of: PlayoffPhase): BracketSource => ({ from: 'loser', of })

/**
 * The Page system: the top of the table buys a second life.
 *
 * First and second meet, and the loser of that drops into the semi-final rather
 * than out, so either can lose once and still take the tournament. Everyone
 * else goes out on their first defeat. The elimination round is the only
 * difference between three teams and four, which is what keeps it one rule
 * rather than two formats.
 */
export function buildBracket(teamCount: number): BracketPairing[] {
  if (teamCount !== 3 && teamCount !== 4) {
    throw new UnsupportedTeamCountError(teamCount)
  }

  const qualification: BracketPairing = {
    phase: 'qualification',
    home: seed(1),
    away: seed(2),
  }

  const final: BracketPairing = {
    phase: 'final',
    home: winner('qualification'),
    away: winner('semi-final'),
  }

  if (teamCount === 3) {
    return [
      qualification,
      { phase: 'semi-final', home: loser('qualification'), away: seed(3) },
      final,
    ]
  }

  return [
    qualification,
    { phase: 'elimination', home: seed(3), away: seed(4) },
    { phase: 'semi-final', home: loser('qualification'), away: winner('elimination') },
    final,
  ]
}
