import type { Player } from './types'

/**
 * The identity key of a player in the pool. A database index can only enforce
 * exact equality, so the normalisation has to happen before the write: this is
 * what makes " Lucas  MARTIN " and "lucas martin" the same person.
 */
export function buildNameKey(firstName: string, lastName: string): string {
  return `${normalise(firstName)} ${normalise(lastName)}`.trim()
}

/**
 * How a player is named on screen, within a given scope: one edition's roster
 * in most views, the whole pool in the cumulative statistics.
 *
 * People say "Benjamin" until a second Benjamin walks in, and only then reach
 * for a surname. The display follows that, and falls back to the full surname
 * when even the initial stays ambiguous.
 */
export function displayName(player: Player, scope: readonly Player[]): string {
  const homonyms = scope.filter(
    (other) =>
      other.nameKey !== player.nameKey &&
      normalise(other.firstName) === normalise(player.firstName),
  )

  if (homonyms.length === 0) {
    return player.firstName
  }

  const initial = initialOf(player)
  const initialIsTaken = homonyms.some((other) => initialOf(other) === initial)

  return initialIsTaken
    ? `${player.firstName} ${player.lastName}`
    : `${player.firstName} ${initial}.`
}

function initialOf(player: Player): string {
  return player.lastName.charAt(0).toLocaleUpperCase('fr')
}

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
}
