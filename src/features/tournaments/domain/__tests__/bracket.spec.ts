import { describe, expect, it } from 'vitest'
import { buildBracket, UnsupportedTeamCountError } from '../bracket'

describe('buildBracket', () => {
  it('sends three teams through three matches, with no elimination round', () => {
    const bracket = buildBracket(3)

    expect(bracket).toEqual([
      { phase: 'qualification', home: { from: 'seed', rank: 1 }, away: { from: 'seed', rank: 2 } },
      {
        phase: 'semi-final',
        home: { from: 'loser', of: 'qualification' },
        away: { from: 'seed', rank: 3 },
      },
      {
        phase: 'final',
        home: { from: 'winner', of: 'qualification' },
        away: { from: 'winner', of: 'semi-final' },
      },
    ])
  })

  it('adds one elimination round for four teams, and nothing else', () => {
    const bracket = buildBracket(4)

    expect(bracket).toEqual([
      { phase: 'qualification', home: { from: 'seed', rank: 1 }, away: { from: 'seed', rank: 2 } },
      { phase: 'elimination', home: { from: 'seed', rank: 3 }, away: { from: 'seed', rank: 4 } },
      {
        phase: 'semi-final',
        home: { from: 'loser', of: 'qualification' },
        away: { from: 'winner', of: 'elimination' },
      },
      {
        phase: 'final',
        home: { from: 'winner', of: 'qualification' },
        away: { from: 'winner', of: 'semi-final' },
      },
    ])
  })

  it('buys the top two a second life, which is the whole point of the system', () => {
    for (const teamCount of [3, 4]) {
      const bracket = buildBracket(teamCount)
      const qualification = bracket.find((pairing) => pairing.phase === 'qualification')
      const semi = bracket.find((pairing) => pairing.phase === 'semi-final')

      // First and second meet, and the one that loses drops into the semi
      // rather than out: either can lose once and still take the tournament.
      expect(qualification?.home).toEqual({ from: 'seed', rank: 1 })
      expect(qualification?.away).toEqual({ from: 'seed', rank: 2 })
      expect(semi?.home).toEqual({ from: 'loser', of: 'qualification' })
    }
  })

  it('never sends a seed below second straight to the final', () => {
    for (const teamCount of [3, 4]) {
      const final = buildBracket(teamCount).find((pairing) => pairing.phase === 'final')

      expect(final?.home).toEqual({ from: 'winner', of: 'qualification' })
      expect(final?.away).toEqual({ from: 'winner', of: 'semi-final' })
    }
  })

  it.each([2, 5, 8])('refuses a playoff for %i teams', (teamCount) => {
    expect(() => buildBracket(teamCount)).toThrow(UnsupportedTeamCountError)
  })
})
