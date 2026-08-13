import { describe, expect, it } from 'vitest'
import { buildStandings, compareTeams, POINTS_PER_WIN } from '../standings'
import { playedRoundRobin } from '../score'
import type { Match, MatchPhase } from '../types'

const A = 1
const B = 2
const C = 3
const D = 4

interface Played {
  blue: number
  white: number
  winner: number
  loserScore: number
  phase?: MatchPhase
}

function match(played: Played): Match {
  return {
    tournamentId: 1,
    phase: played.phase ?? 'round-robin',
    duel: 1,
    rankInDuel: 1,
    blueTeamId: played.blue,
    whiteTeamId: played.white,
    blueDefenderId: played.blue * 10,
    blueAttackerId: played.blue * 10 + 1,
    whiteDefenderId: played.white * 10,
    whiteAttackerId: played.white * 10 + 1,
    winnerTeamId: played.winner,
    loserScore: played.loserScore,
    enteredAt: 1,
  }
}

/** `wins` matches won by `winner` against `loser`, each by ten to `loserScore`. */
function duel(winner: number, loser: number, wins: number, loserScore = 0): Match[] {
  return Array.from({ length: wins }, () =>
    match({ blue: winner, white: loser, winner, loserScore }),
  )
}

function rankOf(rows: readonly { teamId: number; rank: number }[], teamId: number): number {
  return rows.find((row) => row.teamId === teamId)?.rank ?? 0
}

describe('standings', () => {
  it('gives three points for a win and nothing for a loss', () => {
    const { rows } = buildStandings([A, B], duel(A, B, 3, 5))

    expect(POINTS_PER_WIN).toBe(3)
    expect(rows[0]).toMatchObject({ teamId: A, wins: 3, losses: 0, points: 9 })
    expect(rows[1]).toMatchObject({ teamId: B, wins: 0, losses: 3, points: 0 })
  })

  it('counts the winner at ten and the loser at what they stopped on', () => {
    const { rows } = buildStandings(
      [A, B],
      [match({ blue: A, white: B, winner: A, loserScore: 7 })],
    )

    expect(rows[0]).toMatchObject({ teamId: A, goalsFor: 10, goalsAgainst: 7, goalDifference: 3 })
    expect(rows[1]).toMatchObject({ teamId: B, goalsFor: 7, goalsAgainst: 10, goalDifference: -3 })
  })

  it('ignores anything outside the round robin', () => {
    const matches = [
      match({ blue: A, white: B, winner: A, loserScore: 0 }),
      match({ blue: B, white: A, winner: B, loserScore: 0, phase: 'final' }),
      match({ blue: B, white: A, winner: B, loserScore: 0, phase: 'semi-final' }),
    ]

    const { rows } = buildStandings([A, B], matches)

    expect(rows[0]).toMatchObject({ teamId: A, played: 1, wins: 1, points: 3 })
    expect(rows[1]).toMatchObject({ teamId: B, played: 1, wins: 0, points: 0 })
  })

  it('ignores a match that has not been played', () => {
    const pending = { ...match({ blue: A, white: B, winner: A, loserScore: 3 }) }
    pending.winnerTeamId = null
    pending.loserScore = null

    const { rows } = buildStandings([A, B], [pending])

    expect(rows.every((row) => row.played === 0)).toBe(true)
  })
})

describe('the tie-break cascade', () => {
  it('separates on points first', () => {
    const table = buildStandings([A, B], duel(A, B, 3, 9))

    expect(table.rows.map((row) => row.teamId)).toEqual([A, B])
    expect(table.rows[0]?.separation).toBe('points')
  })

  it('separates level teams on the duel record between them', () => {
    // Two apiece against C, so the general record is level; A took their own duel 3-1.
    const matches = [
      ...duel(A, B, 3, 8),
      ...duel(B, A, 1, 8),
      ...duel(A, C, 2, 8),
      ...duel(C, A, 2, 8),
      ...duel(B, C, 4, 8),
      ...duel(C, B, 0, 8),
    ]

    const table = buildStandings([A, B, C], matches)
    const [first, second] = table.rows

    expect(first?.teamId).toBe(A)
    expect(second?.teamId).toBe(B)
    expect(first?.points).toBe(second?.points)
    expect(first?.separation).toBe('head-to-head')
  })

  it('falls to the goal difference of that duel when its record is level', () => {
    // Two wins each in their duel, but A won by more than B did: +8 against -8.
    const matches = [
      ...duel(A, B, 2, 2),
      ...duel(B, A, 2, 6),
      ...duel(A, C, 1, 0),
      ...duel(C, A, 3, 0),
      ...duel(B, C, 1, 0),
      ...duel(C, B, 3, 0),
    ]

    const table = buildStandings([A, B, C], matches)

    expect(table.rows.map((row) => row.teamId)).toEqual([C, A, B])
    expect(table.rows[1]?.points).toBe(table.rows[2]?.points)
    expect(table.rows[1]?.separation).toBe('head-to-head-goal-difference')
  })

  it('falls to general goal difference only when the duel separates nothing', () => {
    // Their own duel is a perfect mirror, so only the matches against C can decide.
    const matches = [
      ...duel(A, B, 2, 4),
      ...duel(B, A, 2, 4),
      ...duel(A, C, 2, 0),
      ...duel(C, A, 2, 9),
      ...duel(B, C, 2, 3),
      ...duel(C, B, 2, 9),
    ]

    const table = buildStandings([A, B, C], matches)
    const [first, second] = table.rows

    expect(first?.points).toBe(second?.points)
    expect(first?.teamId).toBe(A)
    expect(first?.separation).toBe('goal-difference')
    expect(Number(first?.goalDifference)).toBeGreaterThan(Number(second?.goalDifference))

    // Three teams level on points, and the cascade still agrees with itself:
    // detecting circles must not turn every tie into an arbitration.
    expect(table.arbitration).toEqual([])
  })

  it('puts the duel record ahead of general goal difference, which is the point of the order', () => {
    // A beat B 3-1 in their duel, yet ends on -11 against B's +7 overall. The
    // documented order puts A above anyway, and that is the whole argument.
    const matches = [
      ...duel(A, B, 3, 9),
      ...duel(B, A, 1, 0),
      ...duel(C, A, 4, 9),
      ...duel(B, C, 2, 0),
      ...duel(C, B, 2, 0),
    ]

    const records = buildStandings([A, B, C], matches)
    const a = records.rows.find((row) => row.teamId === A)
    const b = records.rows.find((row) => row.teamId === B)

    expect(a?.points).toBe(b?.points)
    expect(Number(b?.goalDifference)).toBeGreaterThan(Number(a?.goalDifference))
    expect(rankOf(records.rows, A)).toBeLessThan(rankOf(records.rows, B))
    expect(a?.separation).toBe('head-to-head')
  })

  it('hands a pair it cannot separate to the organisers rather than inventing a rule', () => {
    // A perfect mirror everywhere: every level of the cascade comes back level.
    const matches = [
      ...duel(A, B, 2, 5),
      ...duel(B, A, 2, 5),
      ...duel(A, C, 2, 3),
      ...duel(C, A, 2, 3),
      ...duel(B, C, 2, 3),
      ...duel(C, B, 2, 3),
    ]

    const table = buildStandings([A, B], matches)

    expect(table.rows[0]?.separation).toBe('unresolved')
    expect(table.arbitration).toEqual([[A, B]])
    expect(table.rows[0]?.rank).toBe(table.rows[1]?.rank)
  })

  it('refuses to order a circle of duel wins, whatever the goal differences say', () => {
    // 1 beats 2, 2 beats 3, 3 beats 1, every duel three to one. Four wins each,
    // so twelve points each, and three different goal differences. There is no
    // first place in a circle: ordering it would tell the team that won three
    // to one it finished last, and cite the duel record while doing it.
    const matches = [
      ...duel(A, B, 3, 0),
      ...duel(B, A, 1, 0),
      ...duel(B, C, 3, 5),
      ...duel(C, B, 1, 5),
      ...duel(C, A, 3, 8),
      ...duel(A, C, 1, 8),
    ]

    const table = buildStandings([A, B, C], matches)

    expect(table.rows.every((row) => row.points === 12)).toBe(true)
    // Distinct goal differences: grouping on them would miss this entirely.
    expect(new Set(table.rows.map((row) => row.goalDifference)).size).toBe(3)

    expect(table.arbitration).toEqual([[A, B, C]])
    expect(new Set(table.rows.map((row) => row.rank)).size).toBe(1)
    expect(table.rows.slice(0, 2).every((row) => row.separation === 'unresolved')).toBe(true)
  })

  it('refuses a circle of four teams as readily as one of three', () => {
    // A beats B, B beats C, C beats D, D beats A, the other two duels split
    // evenly. Six wins each, and four goal differences that are all different,
    // so nothing but the circle itself can catch this.
    const matches = [
      ...duel(A, B, 3, 0),
      ...duel(B, A, 1, 0),
      ...duel(B, C, 3, 5),
      ...duel(C, B, 1, 5),
      ...duel(C, D, 3, 8),
      ...duel(D, C, 1, 8),
      ...duel(D, A, 3, 2),
      ...duel(A, D, 1, 2),
      ...duel(A, C, 2, 4),
      ...duel(C, A, 2, 4),
      ...duel(B, D, 2, 6),
      ...duel(D, B, 2, 6),
    ]

    const table = buildStandings([A, B, C, D], matches)

    expect(table.rows.every((row) => row.points === 18)).toBe(true)
    expect(new Set(table.rows.map((row) => row.goalDifference)).size).toBe(4)

    expect(table.arbitration).toEqual([[A, B, C, D]])
    expect(new Set(table.rows.map((row) => row.rank)).size).toBe(1)
  })

  it('hands a three-way tie to the organisers, as the rules say to', () => {
    // Each team beats the next in a circle, so nothing separates any of them.
    const matches = [
      ...duel(A, B, 2, 4),
      ...duel(B, A, 2, 4),
      ...duel(B, C, 2, 4),
      ...duel(C, B, 2, 4),
      ...duel(C, A, 2, 4),
      ...duel(A, C, 2, 4),
    ]

    const table = buildStandings([A, B, C], matches)

    expect(table.arbitration).toEqual([[A, B, C]])
    expect(new Set(table.rows.map((row) => row.rank)).size).toBe(1)
    expect(table.rows.slice(0, 2).every((row) => row.separation === 'unresolved')).toBe(true)
  })

  it('has nothing to arbitrate before a single match has been played', () => {
    // Everyone is level on nothing, which is not a tie anyone has to settle.
    const table = buildStandings([A, B, C], [])

    expect(table.rows.every((row) => row.played === 0)).toBe(true)
    expect(table.arbitration).toEqual([])
  })

  it('reports no arbitration when the cascade decided everything', () => {
    const table = buildStandings([A, B], duel(A, B, 3, 1))

    expect(table.arbitration).toEqual([])
    expect(table.rows.map((row) => row.rank)).toEqual([1, 2])
  })

  it('compares two teams the same way whichever order they are given in', () => {
    const matches = playedRoundRobin(duel(A, B, 3, 2))
    const table = buildStandings([A, B], duel(A, B, 3, 2))
    const [a, b] = table.rows

    if (a === undefined || b === undefined) {
      throw new Error('expected two rows')
    }

    expect(compareTeams(a, b, matches).order).toBeLessThan(0)
    expect(compareTeams(b, a, matches).order).toBeGreaterThan(0)
    expect(compareTeams(a, b, matches).level).toBe(compareTeams(b, a, matches).level)
  })
})
