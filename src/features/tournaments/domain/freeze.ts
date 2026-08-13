import type { BracketPairing } from './bracket'
import type { SeparationLevel } from './standings'

export interface FrozenStanding {
  rank: number
  teamId: number
  played: number
  wins: number
  losses: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  separation: SeparationLevel | null
}

export interface FrozenConfiguration {
  teamId: number
  defenderId: number
  attackerId: number
  /** True when the team's two were exactly level and the team picked this one. */
  chosen: boolean
}

/**
 * The group phase as it stood at the moment it was closed.
 *
 * Stored rather than recomputed, because the playoff is seeded from it: a
 * derivation that could still move would make the seeding depend on matches
 * played after it was decided. One row per edition, written once.
 */
export interface FrozenEdition {
  tournamentId: number
  standings: FrozenStanding[]
  configurations: FrozenConfiguration[]
  bracket: BracketPairing[]
  frozenAt: number
}
