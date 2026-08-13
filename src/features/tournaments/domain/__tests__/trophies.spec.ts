import { describe, expect, it } from 'vitest'
import { bestAttacker, bestDefender, buildPlayerRecords } from '../trophies'
import type { Match, MatchPhase } from '../types'

const BLUE = 1
const WHITE = 2

interface Played {
  blueDefender: number
  blueAttacker: number
  whiteDefender: number
  whiteAttacker: number
  blueWins: boolean
  loserScore: number
  phase?: MatchPhase
}

function match(played: Played): Match {
  return {
    tournamentId: 1,
    phase: played.phase ?? 'round-robin',
    duel: 1,
    rankInDuel: 1,
    blueTeamId: BLUE,
    whiteTeamId: WHITE,
    blueDefenderId: played.blueDefender,
    blueAttackerId: played.blueAttacker,
    whiteDefenderId: played.whiteDefender,
    whiteAttackerId: played.whiteAttacker,
    winnerTeamId: played.blueWins ? BLUE : WHITE,
    loserScore: played.loserScore,
    enteredAt: 1,
  }
}

function record(records: ReturnType<typeof buildPlayerRecords>, playerId: number) {
  return records.find((candidate) => candidate.playerId === playerId)
}

describe('buildPlayerRecords', () => {
  it('charges a defender with what the other side put past them', () => {
    // Blue wins 10-3: the white defender conceded ten, the blue defender three.
    const records = buildPlayerRecords([
      match({
        blueDefender: 10,
        blueAttacker: 11,
        whiteDefender: 20,
        whiteAttacker: 21,
        blueWins: true,
        loserScore: 3,
      }),
    ])

    expect(record(records, 10)).toMatchObject({
      matchesDefended: 1,
      goalsConceded: 3,
      concededPerMatch: 3,
    })
    expect(record(records, 20)).toMatchObject({
      matchesDefended: 1,
      goalsConceded: 10,
      concededPerMatch: 10,
    })
  })

  it('credits an attacker with what their own side put in', () => {
    const records = buildPlayerRecords([
      match({
        blueDefender: 10,
        blueAttacker: 11,
        whiteDefender: 20,
        whiteAttacker: 21,
        blueWins: true,
        loserScore: 3,
      }),
    ])

    expect(record(records, 11)).toMatchObject({ matchesAttacked: 1, goalsScored: 10 })
    expect(record(records, 21)).toMatchObject({ matchesAttacked: 1, goalsScored: 3 })
  })

  it('averages rather than totals, so volume is not a trophy', () => {
    const heavy = match({
      blueDefender: 10,
      blueAttacker: 11,
      whiteDefender: 20,
      whiteAttacker: 21,
      blueWins: true,
      loserScore: 2,
    })

    const records = buildPlayerRecords([heavy, heavy, heavy])

    expect(record(records, 10)).toMatchObject({
      matchesDefended: 3,
      goalsConceded: 6,
      concededPerMatch: 2,
    })
  })

  it('follows a player who swaps posts, counting each match at the post held', () => {
    const records = buildPlayerRecords([
      match({
        blueDefender: 10,
        blueAttacker: 11,
        whiteDefender: 20,
        whiteAttacker: 21,
        blueWins: true,
        loserScore: 4,
      }),
      match({
        blueDefender: 11,
        blueAttacker: 10,
        whiteDefender: 20,
        whiteAttacker: 21,
        blueWins: true,
        loserScore: 4,
      }),
    ])

    expect(record(records, 10)).toMatchObject({
      matchesDefended: 1,
      goalsConceded: 4,
      matchesAttacked: 1,
      goalsScored: 10,
    })
  })

  it('ignores anything outside the round robin', () => {
    const records = buildPlayerRecords([
      match({
        blueDefender: 10,
        blueAttacker: 11,
        whiteDefender: 20,
        whiteAttacker: 21,
        blueWins: true,
        loserScore: 0,
        phase: 'final',
      }),
    ])

    expect(records).toEqual([])
  })

  it('ignores a match nobody has entered', () => {
    const pending = {
      ...match({
        blueDefender: 10,
        blueAttacker: 11,
        whiteDefender: 20,
        whiteAttacker: 21,
        blueWins: true,
        loserScore: 0,
      }),
      winnerTeamId: null,
      loserScore: null,
    }

    expect(buildPlayerRecords([pending])).toEqual([])
  })
})

describe('the trophies', () => {
  const matches = [
    // 10 defends and concedes 2; 20 defends and concedes 10.
    match({
      blueDefender: 10,
      blueAttacker: 11,
      whiteDefender: 20,
      whiteAttacker: 21,
      blueWins: true,
      loserScore: 2,
    }),
    // 30 defends and concedes 9, which is worse than 10 but better than 20.
    match({
      blueDefender: 30,
      blueAttacker: 31,
      whiteDefender: 40,
      whiteAttacker: 41,
      blueWins: false,
      loserScore: 9,
    }),
  ]

  it('gives the defence to the lowest average conceded', () => {
    expect(bestDefender(buildPlayerRecords(matches))?.playerId).toBe(10)
  })

  it('gives the attack to the highest average scored', () => {
    // 11 attacked in a 10-2 win, 41 in a 10-9 win: both averaged ten.
    const winner = bestAttacker(buildPlayerRecords(matches))

    expect(winner?.scoredPerMatch).toBe(10)
    expect([11, 41]).toContain(winner?.playerId)
  })

  it('hands out nothing at all before anything is played', () => {
    expect(bestDefender([])).toBeNull()
    expect(bestAttacker([])).toBeNull()
  })
})
