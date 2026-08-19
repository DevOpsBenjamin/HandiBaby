import { describe, expect, it } from 'vitest'
import { computeSideStats } from '../sideStats'
import type { Match } from '../types'

function makeMatch(overrides: Partial<Match>): Match {
  return {
    tournamentId: 1,
    phase: 'round-robin',
    duel: 1,
    rankInDuel: 1,
    blueTeamId: 1,
    whiteTeamId: 2,
    blueDefenderId: 1,
    blueAttackerId: 2,
    whiteDefenderId: 3,
    whiteAttackerId: 4,
    winnerTeamId: null,
    loserScore: null,
    enteredAt: null,
    ...overrides,
  }
}

describe('sideStats', () => {
  it('returns empty records when no match is played', () => {
    const matches = [makeMatch({ winnerTeamId: null, loserScore: null })]
    const stats = computeSideStats([1, 2], matches)

    expect(stats.overall.played).toBe(0)
    expect(stats.overall.blueWins).toBe(0)
    expect(stats.overall.whiteWins).toBe(0)
    expect(stats.overall.blueWinRate).toBeNull()
    expect(stats.overall.whiteWinRate).toBeNull()

    expect(stats.teams[0]?.blue.played).toBe(0)
    expect(stats.teams[0]?.blue.winRate).toBeNull()
  })

  it('computes overall and per team side winrates correctly', () => {
    const matches = [
      // Match 1: Team 1 (Blue) beats Team 2 (White) 10-6
      makeMatch({ blueTeamId: 1, whiteTeamId: 2, winnerTeamId: 1, loserScore: 6 }),
      // Match 2: Team 2 (Blue) beats Team 1 (White) 10-4
      makeMatch({ blueTeamId: 2, whiteTeamId: 1, winnerTeamId: 2, loserScore: 4 }),
      // Match 3: Team 1 (Blue) beats Team 3 (White) 10-8
      makeMatch({ blueTeamId: 1, whiteTeamId: 3, winnerTeamId: 1, loserScore: 8 }),
      // Match 4: Team 3 (White) beats Team 2 (Blue) 10-7 (White win!)
      makeMatch({ blueTeamId: 2, whiteTeamId: 3, winnerTeamId: 3, loserScore: 7 }),
    ]

    const stats = computeSideStats([1, 2, 3], matches)

    // Overall
    expect(stats.overall.played).toBe(4)
    expect(stats.overall.blueWins).toBe(3)
    expect(stats.overall.whiteWins).toBe(1)
    expect(stats.overall.blueWinRate).toBe(75.0)
    expect(stats.overall.whiteWinRate).toBe(25.0)
    expect(stats.overall.blueGoals).toBe(10 + 10 + 10 + 7) // 37
    expect(stats.overall.whiteGoals).toBe(6 + 4 + 8 + 10) // 28

    // Team 1: Blue 2-0 (100%), White 0-1 (0%)
    const team1 = stats.teams.find((t) => t.teamId === 1)
    expect(team1?.blue.played).toBe(2)
    expect(team1?.blue.wins).toBe(2)
    expect(team1?.blue.losses).toBe(0)
    expect(team1?.blue.winRate).toBe(100.0)
    expect(team1?.blue.goalDifference).toBe(10 - 6 + 10 - 8) // +6
    expect(team1?.white.played).toBe(1)
    expect(team1?.white.wins).toBe(0)
    expect(team1?.white.losses).toBe(1)
    expect(team1?.white.winRate).toBe(0.0)
    expect(team1?.white.goalDifference).toBe(4 - 10) // -6

    // Team 2: Blue 1-1 (50%), White 0-1 (0%)
    const team2 = stats.teams.find((t) => t.teamId === 2)
    expect(team2?.blue.played).toBe(2)
    expect(team2?.blue.wins).toBe(1)
    expect(team2?.blue.losses).toBe(1)
    expect(team2?.blue.winRate).toBe(50.0)

    // Team 3: Blue 0-0 (null), White 1-1 (50%)
    const team3 = stats.teams.find((t) => t.teamId === 3)
    expect(team3?.blue.played).toBe(0)
    expect(team3?.blue.winRate).toBeNull()
    expect(team3?.white.played).toBe(2)
    expect(team3?.white.wins).toBe(1)
    expect(team3?.white.winRate).toBe(50.0)
  })
})
