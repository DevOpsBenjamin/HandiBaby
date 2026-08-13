/** Injected so tests can drive the draw deterministically. */
export type Rng = () => number

export interface TeamComposition {
  label: string
  players: readonly [number, number]
}

/** 3 or 4 teams of two, so 6 or 8 players. Five teams would mean forty matches. */
export const SUPPORTED_PLAYER_COUNTS = [6, 8] as const

export function isSupportedPlayerCount(count: number): boolean {
  return SUPPORTED_PLAYER_COUNTS.some((supported) => supported === count)
}

function defaultLabel(index: number): string {
  return `Équipe ${index + 1}`
}

/**
 * Sorting on independent uniform keys yields a uniform permutation, unlike
 * shuffling with a random comparator.
 */
function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  return items
    .map((item) => ({ item, key: rng() }))
    .sort((left, right) => left.key - right.key)
    .map((entry) => entry.item)
}

function pair(playerIds: readonly number[]): TeamComposition[] {
  const teams: TeamComposition[] = []

  for (let index = 0; index < playerIds.length; index += 2) {
    const first = playerIds[index]
    const second = playerIds[index + 1]

    if (first === undefined || second === undefined) {
      throw new Error('Players must come in pairs')
    }

    teams.push({ label: defaultLabel(teams.length), players: [first, second] })
  }

  return teams
}

/** Random draw. Mixing pairs across editions is what makes the cumulative stats credible. */
export function drawTeams(playerIds: readonly number[], rng: Rng = Math.random): TeamComposition[] {
  assertUsablePool(playerIds)
  return pair(shuffle(playerIds, rng))
}

/** Manual composition: the caller decides the pairs, this only checks them. */
export function buildTeams(pairs: readonly (readonly [number, number])[]): TeamComposition[] {
  assertUsablePool(pairs.flat())
  return pairs.map((players, index) => ({ label: defaultLabel(index), players }))
}

function assertUsablePool(playerIds: readonly number[]): void {
  if (!isSupportedPlayerCount(playerIds.length)) {
    throw new Error(
      `A tournament needs ${SUPPORTED_PLAYER_COUNTS.join(' or ')} players, received ${playerIds.length}`,
    )
  }

  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error('A player cannot appear twice')
  }
}
