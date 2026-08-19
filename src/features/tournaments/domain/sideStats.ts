import { playedRoundRobin, WINNING_SCORE, type PlayedMatch } from './score'
import type { Match } from './types'

export interface SideRecord {
  played: number
  wins: number
  losses: number
  winRate: number | null
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

export interface TeamSideStat {
  teamId: number
  blue: SideRecord
  white: SideRecord
}

export interface OverallSideStats {
  played: number
  blueWins: number
  whiteWins: number
  blueWinRate: number | null
  whiteWinRate: number | null
  blueGoals: number
  whiteGoals: number
}

export interface TableSideStats {
  overall: OverallSideStats
  teams: TeamSideStat[]
}

function emptyRecord(): SideRecord {
  return {
    played: 0,
    wins: 0,
    losses: 0,
    winRate: null,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  }
}

export function buildSideRecord(
  teamId: number,
  side: 'blue' | 'white',
  matches: readonly PlayedMatch[],
): SideRecord {
  const sideMatches = matches.filter((m) =>
    side === 'blue' ? m.blueTeamId === teamId : m.whiteTeamId === teamId,
  )

  if (sideMatches.length === 0) {
    return emptyRecord()
  }

  let wins = 0
  let losses = 0
  let scored = 0
  let conceded = 0

  for (const match of sideMatches) {
    if (match.winnerTeamId === teamId) {
      wins += 1
      scored += WINNING_SCORE
      conceded += match.loserScore
    } else {
      losses += 1
      scored += match.loserScore
      conceded += WINNING_SCORE
    }
  }

  const played = wins + losses
  const winRate = played > 0 ? Math.round((wins / played) * 1000) / 10 : null

  return {
    played,
    wins,
    losses,
    winRate,
    goalsFor: scored,
    goalsAgainst: conceded,
    goalDifference: scored - conceded,
  }
}

export function computeSideStats(
  teamIds: readonly number[],
  matches: readonly Match[],
): TableSideStats {
  const played = playedRoundRobin(matches)
  const total = played.length

  let blueWins = 0
  let whiteWins = 0
  let blueGoals = 0
  let whiteGoals = 0

  for (const match of played) {
    if (match.winnerTeamId === match.blueTeamId) {
      blueWins += 1
      blueGoals += WINNING_SCORE
      whiteGoals += match.loserScore
    } else {
      whiteWins += 1
      whiteGoals += WINNING_SCORE
      blueGoals += match.loserScore
    }
  }

  const overall: OverallSideStats = {
    played: total,
    blueWins,
    whiteWins,
    blueWinRate: total > 0 ? Math.round((blueWins / total) * 1000) / 10 : null,
    whiteWinRate: total > 0 ? Math.round((whiteWins / total) * 1000) / 10 : null,
    blueGoals,
    whiteGoals,
  }

  const teams: TeamSideStat[] = teamIds.map((teamId) => ({
    teamId,
    blue: buildSideRecord(teamId, 'blue', played),
    white: buildSideRecord(teamId, 'white', played),
  }))

  return { overall, teams }
}
