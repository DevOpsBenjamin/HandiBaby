/**
 * The identity key of a player in the pool. A database index can only enforce
 * exact equality, so the normalisation has to happen before the write: this is
 * what makes " Lucas  MARTIN " and "lucas martin" the same person.
 */
export function buildNameKey(firstName: string, lastName: string): string {
  return `${normalise(firstName)} ${normalise(lastName)}`.trim()
}

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
}
