import { describe, expect, it } from 'vitest'
import { buildTeams, drawTeams, isSupportedPlayerCount } from '../draw'

/** Cycles through fixed keys so the draw is reproducible. */
function sequenceRng(values: readonly number[]): () => number {
  let index = 0
  return () => {
    const value = values[index % values.length] ?? 0
    index += 1
    return value
  }
}

describe('isSupportedPlayerCount', () => {
  it('accepts only 6 or 8 players', () => {
    expect(isSupportedPlayerCount(6)).toBe(true)
    expect(isSupportedPlayerCount(8)).toBe(true)
    expect([0, 4, 5, 7, 10].some(isSupportedPlayerCount)).toBe(false)
  })
})

describe('drawTeams', () => {
  it('splits the pool into pairs and uses every player exactly once', () => {
    const players = [1, 2, 3, 4, 5, 6]
    const teams = drawTeams(players, sequenceRng([0.9, 0.1, 0.5, 0.2, 0.7, 0.3]))

    expect(teams).toHaveLength(3)
    expect(teams.flatMap((team) => team.players).sort((a, b) => a - b)).toEqual(players)
    expect(teams.map((team) => team.label)).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3'])
  })

  it('builds four teams from eight players', () => {
    const teams = drawTeams([1, 2, 3, 4, 5, 6, 7, 8], sequenceRng([0.5]))

    expect(teams).toHaveLength(4)
    expect(new Set(teams.flatMap((team) => team.players)).size).toBe(8)
  })

  it('depends on the draw: a different rng yields a different pairing', () => {
    const players = [1, 2, 3, 4, 5, 6]
    const first = drawTeams(players, sequenceRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]))
    const second = drawTeams(players, sequenceRng([0.6, 0.5, 0.4, 0.3, 0.2, 0.1]))

    expect(first.map((team) => team.players)).not.toEqual(second.map((team) => team.players))
  })

  it('refuses a pool the format cannot seat', () => {
    expect(() => drawTeams([1, 2, 3, 4, 5])).toThrow(/6 or 8 players/)
    expect(() => drawTeams([1, 2, 3, 4, 5, 6, 7])).toThrow(/6 or 8 players/)
  })

  it('refuses the same player twice', () => {
    expect(() => drawTeams([1, 1, 2, 3, 4, 5])).toThrow(/twice/)
  })
})

describe('buildTeams', () => {
  it('keeps the pairs it is given', () => {
    const teams = buildTeams([
      [3, 1],
      [2, 6],
      [5, 4],
    ])

    expect(teams.map((team) => team.players)).toEqual([
      [3, 1],
      [2, 6],
      [5, 4],
    ])
  })

  it('applies the same checks as the draw', () => {
    expect(() =>
      buildTeams([
        [1, 2],
        [3, 1],
        [4, 5],
      ]),
    ).toThrow(/twice/)

    expect(() =>
      buildTeams([
        [1, 2],
        [3, 4],
      ]),
    ).toThrow(/6 or 8 players/)
  })
})
