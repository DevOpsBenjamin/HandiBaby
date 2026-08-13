import type { Standing } from './standings'

export class ArbitrationMismatchError extends Error {
  constructor() {
    super('L’ordre arbitré doit contenir exactement les équipes à départager')
    this.name = 'ArbitrationMismatchError'
  }
}

function sameTeams(left: readonly number[], right: readonly number[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((teamId) => right.includes(teamId))
  )
}

/**
 * Puts the organisers' decision where the cascade stopped.
 *
 * The rows keep saying the rules separated nobody, because they did not. What
 * changes is that the group now has an order somebody chose and signed, which
 * is what the bracket can be seeded from. Every other row keeps its place: an
 * arbitrated group only ever reshuffles the seats it already occupied.
 */
export function applyArbitration(
  rows: readonly Standing[],
  groups: readonly (readonly number[])[],
  decisions: readonly (readonly number[])[],
): Standing[] {
  const position = new Map<number, number>()
  rows.forEach((row, index) => position.set(row.teamId, index))

  for (const group of groups) {
    const decision = decisions.find((candidate) => sameTeams(candidate, group))

    if (decision === undefined) {
      throw new ArbitrationMismatchError()
    }

    const slots = group
      .map((teamId) => position.get(teamId) ?? 0)
      .sort((left, right) => left - right)

    decision.forEach((teamId, index) => position.set(teamId, slots[index] ?? 0))
  }

  return [...rows]
    .sort((left, right) => (position.get(left.teamId) ?? 0) - (position.get(right.teamId) ?? 0))
    .map((row, index) => ({ ...row, rank: index + 1 }))
}
