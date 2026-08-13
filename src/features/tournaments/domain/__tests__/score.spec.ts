import { describe, expect, it } from 'vitest'
import { isValidLoserScore, LOSER_SCORES, readResult, WINNING_SCORE } from '../score'
import type { Match } from '../types'

const BLUE_TEAM = 11
const WHITE_TEAM = 22

function match(overrides: Partial<Match> = {}): Match {
  return {
    tournamentId: 1,
    phase: 'round-robin',
    duel: 1,
    rankInDuel: 1,
    blueTeamId: BLUE_TEAM,
    whiteTeamId: WHITE_TEAM,
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

describe('loser scores', () => {
  it('offers every score below the winning one, and only those', () => {
    expect(LOSER_SCORES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it.each([0, 5, 9])('accepts %i', (score) => {
    expect(isValidLoserScore(score)).toBe(true)
  })

  it.each([-1, WINNING_SCORE, 11, 2.5, Number.NaN])('refuses %s', (score) => {
    expect(isValidLoserScore(score)).toBe(false)
  })
})

describe('readResult', () => {
  it('reads no result on a match that has not been played', () => {
    expect(readResult(match())).toBeNull()
  })

  it('names the winning side rather than the team id, which is device local', () => {
    expect(readResult(match({ winnerTeamId: BLUE_TEAM, loserScore: 3 }))).toEqual({
      winningSide: 'blue',
      loserScore: 3,
    })
    expect(readResult(match({ winnerTeamId: WHITE_TEAM, loserScore: 0 }))).toEqual({
      winningSide: 'white',
      loserScore: 0,
    })
  })
})
