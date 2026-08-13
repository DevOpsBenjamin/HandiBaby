import { describe, expect, it } from 'vitest'
import { buildBracket, type PlayoffPhase } from '../bracket'
import type { FrozenStanding } from '../freeze'
import { dependents, resolveBracket, type PlayoffOutcome } from '../playoff'

function standings(teamIds: readonly number[]): FrozenStanding[] {
  return teamIds.map((teamId, index) => ({
    rank: index + 1,
    teamId,
    played: 8,
    wins: 0,
    losses: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    separation: null,
  }))
}

function results(
  entries: readonly [PlayoffPhase, PlayoffOutcome][],
): ReadonlyMap<PlayoffPhase, PlayoffOutcome> {
  return new Map(entries)
}

const THREE = standings([10, 20, 30])
const FOUR = standings([10, 20, 30, 40])

describe('resolveBracket', () => {
  it('opens only the rounds whose seeds are already known', () => {
    const rounds = resolveBracket(buildBracket(3), THREE, results([]))

    expect(rounds.map((round) => [round.phase, round.ready])).toEqual([
      ['qualification', true],
      ['semi-final', false],
      ['final', false],
    ])
    expect(rounds[0]).toMatchObject({ homeTeamId: 10, awayTeamId: 20 })
  })

  it('opens both seeded rounds at once when there are four teams', () => {
    const rounds = resolveBracket(buildBracket(4), FOUR, results([]))

    expect(rounds.filter((round) => round.ready).map((round) => round.phase)).toEqual([
      'qualification',
      'elimination',
    ])
    expect(rounds[1]).toMatchObject({ homeTeamId: 30, awayTeamId: 40 })
  })

  it('drops the qualification loser into the semi rather than out', () => {
    // Second beats first, so first is the one taking the second life.
    const rounds = resolveBracket(
      buildBracket(3),
      THREE,
      results([['qualification', { winnerTeamId: 20, loserTeamId: 10 }]]),
    )

    const semi = rounds.find((round) => round.phase === 'semi-final')
    const final = rounds.find((round) => round.phase === 'final')

    expect(semi).toMatchObject({ homeTeamId: 10, awayTeamId: 30, ready: true })
    expect(final).toMatchObject({ homeTeamId: 20, awayTeamId: null, ready: false })
  })

  it('sends the elimination winner to meet the qualification loser', () => {
    const rounds = resolveBracket(
      buildBracket(4),
      FOUR,
      results([
        ['qualification', { winnerTeamId: 10, loserTeamId: 20 }],
        ['elimination', { winnerTeamId: 40, loserTeamId: 30 }],
      ]),
    )

    expect(rounds.find((round) => round.phase === 'semi-final')).toMatchObject({
      homeTeamId: 20,
      awayTeamId: 40,
      ready: true,
    })
  })

  it('lets a team that lost once still reach the final', () => {
    const rounds = resolveBracket(
      buildBracket(3),
      THREE,
      results([
        ['qualification', { winnerTeamId: 20, loserTeamId: 10 }],
        ['semi-final', { winnerTeamId: 10, loserTeamId: 30 }],
      ]),
    )

    // First lost the qualification and is in the final anyway: the second life.
    expect(rounds.find((round) => round.phase === 'final')).toMatchObject({
      homeTeamId: 20,
      awayTeamId: 10,
      ready: true,
    })
  })

  it('gives the end of the table to the better ranked of the two', () => {
    const rounds = resolveBracket(
      buildBracket(4),
      FOUR,
      results([
        ['qualification', { winnerTeamId: 10, loserTeamId: 20 }],
        ['elimination', { winnerTeamId: 40, loserTeamId: 30 }],
      ]),
    )

    expect(rounds.find((round) => round.phase === 'qualification')?.choosesEnd).toBe(10)
    expect(rounds.find((round) => round.phase === 'elimination')?.choosesEnd).toBe(30)
    // Second against fourth: second was ranked higher, so second chooses.
    expect(rounds.find((round) => round.phase === 'semi-final')?.choosesEnd).toBe(20)
  })

  it('hands nobody the choice on a round that is not ready', () => {
    const rounds = resolveBracket(buildBracket(3), THREE, results([]))

    expect(rounds.find((round) => round.phase === 'final')?.choosesEnd).toBeNull()
  })
})

describe('dependents', () => {
  it('knows the qualification feeds both the semi and the final', () => {
    expect(dependents(buildBracket(3), 'qualification')).toEqual(['semi-final', 'final'])
  })

  it('knows the elimination only feeds the semi', () => {
    expect(dependents(buildBracket(4), 'elimination')).toEqual(['semi-final'])
  })

  it('knows the final feeds nothing, so it is never locked by anything', () => {
    expect(dependents(buildBracket(4), 'final')).toEqual([])
  })
})
