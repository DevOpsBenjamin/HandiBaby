import { describe, expect, it } from 'vitest'
import { bestConfiguration } from '../configurations'
import type { Match, MatchPhase } from '../types'

const TEAM = 1
const OPPONENT = 2

/** The team's two players, and so its two configurations. */
const ANNE = 10
const BRUNO = 11

interface Played {
  defender: number
  attacker: number
  won: boolean
  loserScore: number
  phase?: MatchPhase
}

function match(played: Played): Match {
  return {
    tournamentId: 1,
    phase: played.phase ?? 'round-robin',
    duel: 1,
    rankInDuel: 1,
    blueTeamId: TEAM,
    whiteTeamId: OPPONENT,
    blueDefenderId: played.defender,
    blueAttackerId: played.attacker,
    whiteDefenderId: 20,
    whiteAttackerId: 21,
    winnerTeamId: played.won ? TEAM : OPPONENT,
    loserScore: played.loserScore,
    enteredAt: 1,
  }
}

describe('bestConfiguration', () => {
  it('ranks on wins before goal difference', () => {
    const matches = [
      // Anne defending: one crushing win and a narrow loss, so +9 on one win.
      match({ defender: ANNE, attacker: BRUNO, won: true, loserScore: 0 }),
      match({ defender: ANNE, attacker: BRUNO, won: false, loserScore: 9 }),
      // Bruno defending: two narrow wins, so only +2 but twice as many wins.
      match({ defender: BRUNO, attacker: ANNE, won: true, loserScore: 9 }),
      match({ defender: BRUNO, attacker: ANNE, won: true, loserScore: 9 }),
    ]

    const choice = bestConfiguration(TEAM, matches)

    expect(choice.configurations[0]).toMatchObject({ defenderId: BRUNO, attackerId: ANNE, wins: 2 })
    expect(choice.configurations[1]).toMatchObject({ defenderId: ANNE, attackerId: BRUNO, wins: 1 })
    expect(Number(choice.configurations[1]?.goalDifference)).toBeGreaterThan(
      Number(choice.configurations[0]?.goalDifference),
    )
    expect(choice.tied).toBe(false)
  })

  it('uses goal difference once the wins are level', () => {
    const matches = [
      match({ defender: ANNE, attacker: BRUNO, won: true, loserScore: 1 }),
      match({ defender: ANNE, attacker: BRUNO, won: false, loserScore: 8 }),
      match({ defender: BRUNO, attacker: ANNE, won: true, loserScore: 8 }),
      match({ defender: BRUNO, attacker: ANNE, won: false, loserScore: 1 }),
    ]

    const choice = bestConfiguration(TEAM, matches)

    expect(choice.configurations[0]?.defenderId).toBe(ANNE)
    expect(choice.tied).toBe(false)
  })

  it('says the two are tied rather than picking one, because the team decides', () => {
    const matches = [
      match({ defender: ANNE, attacker: BRUNO, won: true, loserScore: 4 }),
      match({ defender: ANNE, attacker: BRUNO, won: false, loserScore: 4 }),
      match({ defender: BRUNO, attacker: ANNE, won: true, loserScore: 4 }),
      match({ defender: BRUNO, attacker: ANNE, won: false, loserScore: 4 }),
    ]

    const choice = bestConfiguration(TEAM, matches)

    expect(choice.tied).toBe(true)
    expect(choice.configurations).toHaveLength(2)
    expect(choice.configurations[0]?.wins).toBe(choice.configurations[1]?.wins)
    expect(choice.configurations[0]?.goalDifference).toBe(choice.configurations[1]?.goalDifference)
  })

  it('ignores anything outside the round robin', () => {
    const matches = [
      match({ defender: ANNE, attacker: BRUNO, won: true, loserScore: 0 }),
      match({ defender: BRUNO, attacker: ANNE, won: true, loserScore: 0, phase: 'final' }),
      match({ defender: BRUNO, attacker: ANNE, won: true, loserScore: 0, phase: 'semi-final' }),
    ]

    const choice = bestConfiguration(TEAM, matches)

    expect(choice.configurations).toHaveLength(1)
    expect(choice.configurations[0]).toMatchObject({ defenderId: ANNE, played: 1 })
  })

  it('reports nothing at all before the team has played', () => {
    expect(bestConfiguration(TEAM, []).configurations).toEqual([])
    expect(bestConfiguration(TEAM, []).tied).toBe(false)
  })
})
