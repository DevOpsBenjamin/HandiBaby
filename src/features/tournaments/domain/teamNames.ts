/**
 * Long enough for the nicknames people actually invent, short enough that a
 * standings row stays one line on a phone.
 */
export const MAXIMUM_TEAM_NAME_LENGTH = 30

export class TeamNameTooLongError extends Error {
  constructor() {
    super(`Un nom d’équipe fait au plus ${MAXIMUM_TEAM_NAME_LENGTH} caractères`)
    this.name = 'TeamNameTooLongError'
  }
}

export class DuplicateTeamNameError extends Error {
  constructor(readonly name: string) {
    super(`Deux équipes de l’édition ne peuvent pas s’appeler « ${name} »`)
    this.name = 'DuplicateTeamNameError'
  }
}

/** The name a team carries until somebody invents a better one. */
export function defaultTeamLabel(index: number): string {
  return `Équipe ${index + 1}`
}

export function normaliseTeamName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Two names collide the way people would say they collide, not byte for byte. */
function comparisonKey(name: string): string {
  return normaliseTeamName(name).toLocaleLowerCase('fr')
}

/**
 * Turns what was typed into what gets stored: blanks fall back to the numbered
 * default, and no two teams of one edition end up answering to the same name.
 * A standings row that does not identify anybody is worse than a dull one.
 */
export function resolveTeamLabels(names: readonly string[]): string[] {
  const labels = names.map((name, index) => {
    const cleaned = normaliseTeamName(name)

    if (cleaned === '') {
      return defaultTeamLabel(index)
    }

    if (cleaned.length > MAXIMUM_TEAM_NAME_LENGTH) {
      throw new TeamNameTooLongError()
    }

    return cleaned
  })

  const seen = new Set<string>()

  for (const label of labels) {
    const key = comparisonKey(label)

    if (seen.has(key)) {
      throw new DuplicateTeamNameError(label)
    }

    seen.add(key)
  }

  return labels
}

/** The same rules for one team being renamed among the ones already there. */
export function resolveRename(
  name: string,
  fallback: string,
  otherLabels: readonly string[],
): string {
  const cleaned = normaliseTeamName(name)
  const resolved = cleaned === '' ? fallback : cleaned

  if (resolved.length > MAXIMUM_TEAM_NAME_LENGTH) {
    throw new TeamNameTooLongError()
  }

  if (otherLabels.some((other) => comparisonKey(other) === comparisonKey(resolved))) {
    throw new DuplicateTeamNameError(resolved)
  }

  return resolved
}
