export type MatchPhase =
  'round-robin' | 'qualification' | 'elimination' | 'semi-final' | 'final' | 'tiebreak'

export type TournamentStatus =
  /** Being set up: players and teams not settled, no schedule yet. */
  'draft' | 'round-robin' | 'playoff' | 'finished'

export interface Player {
  id?: number
  firstName: string
  lastName: string
  /**
   * Normalised "first last", unique across the pool. Two Lucas are two players;
   * a retyped "lucas martin" resolves to the existing one instead of creating a
   * phantom that would split someone's history in two.
   */
  nameKey: string
}

export interface Tournament {
  id?: number
  label: string
  startDate: string
  status: TournamentStatus
  createdAt: number
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
}

/** Minimal team shape the schedule generator needs. */
export interface ScheduleTeam {
  id: number
  players: readonly [number, number]
}

export type GeneratedMatch = Omit<Match, 'id' | 'tournamentId'>
