export type MatchPhase =
  'round-robin' | 'qualification' | 'elimination' | 'semi-final' | 'final' | 'tiebreak'

/** Which side of the table a team plays on. Decided by the calendar, never at the table. */
export type TableSide = 'blue' | 'white'

export const SIDE_LABELS: Record<TableSide, string> = {
  blue: 'Bleu',
  white: 'Blanc',
}

export type TournamentStatus =
  /** Being set up: players and teams not settled, no schedule yet. */
  'draft' | 'round-robin' | 'playoff' | 'finished'

export interface Tournament {
  id?: number
  /**
   * Generated on the device that creates the edition. The local row id differs
   * from one device to the next, so anything shared between devices, starting
   * with the link and the unlock, keys on this instead.
   */
  publicId: string
  label: string
  startDate: string
  status: TournamentStatus
  /**
   * bcrypt verifier for the passphrase guarding this edition's writes. Travels
   * with the tournament so it can be checked with no network; the server
   * re-verifies every write regardless.
   */
  passphraseHash: string
  createdAt: number
}

const IN_PROGRESS: readonly TournamentStatus[] = ['draft', 'round-robin', 'playoff']

export function isInProgress(status: TournamentStatus): boolean {
  return IN_PROGRESS.includes(status)
}

/** A player taking part in one edition, before teams are composed. */
export interface TournamentPlayer {
  id?: number
  tournamentId: number
  playerId: number
}

export interface Team {
  id?: number
  tournamentId: number
  label: string
  /**
   * Order carries no meaning: who defends and who attacks is decided
   * match by match.
   */
  playerOneId: number
  playerTwoId: number
}

export interface Match {
  id?: number
  tournamentId: number
  phase: MatchPhase
  /** Groups the four matches of one duel. Null outside the round robin. */
  duel: number | null
  /** 1 to 4 inside a duel. Null outside the round robin. */
  rankInDuel: number | null
  blueTeamId: number
  whiteTeamId: number
  blueDefenderId: number
  blueAttackerId: number
  whiteDefenderId: number
  whiteAttackerId: number
  /** Null until the match is played. */
  winnerTeamId: number | null
  /** 0 to 9: the winner always reaches ten. Null until played. */
  loserScore: number | null
  enteredAt: number | null
  /**
   * Playoff only. A result is freely correctable until someone confirms it here,
   * and confirming is what opens the round it feeds. Round-robin matches are
   * frozen in one act instead, when the group phase closes.
   */
  validatedAt?: number | null
}

/** Minimal team shape the schedule generator needs. */
export interface ScheduleTeam {
  id: number
  players: readonly [number, number]
}

export type GeneratedMatch = Omit<Match, 'id' | 'tournamentId'>
