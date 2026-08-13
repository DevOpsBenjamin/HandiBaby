import type { HandiBabyDatabase } from '@/core/db/database'
import { buildNameKey } from './domain/naming'
import type { Player } from './domain/types'

export class DuplicatePlayerError extends Error {
  constructor(readonly existing: Player) {
    super(`${existing.firstName} ${existing.lastName} est déjà dans le vivier`)
    this.name = 'DuplicatePlayerError'
  }
}

export class BlankPlayerNameError extends Error {
  constructor() {
    super('Un joueur a besoin d’un prénom et d’un nom')
    this.name = 'BlankPlayerNameError'
  }
}

export class PlayerRepository {
  constructor(private readonly db: HandiBabyDatabase) {}

  async list(): Promise<Player[]> {
    const players = await this.db.players.toArray()
    return players.sort((left, right) => left.nameKey.localeCompare(right.nameKey, 'fr'))
  }

  async create(firstName: string, lastName: string): Promise<Player> {
    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()

    if (trimmedFirstName === '' || trimmedLastName === '') {
      throw new BlankPlayerNameError()
    }

    const nameKey = buildNameKey(trimmedFirstName, trimmedLastName)
    const existing = await this.db.players.where('nameKey').equals(nameKey).first()

    if (existing !== undefined) {
      throw new DuplicatePlayerError(existing)
    }

    const player: Player = {
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      nameKey,
    }

    // The unique index is the real guard: the lookup above only exists to name
    // the player already holding the key.
    const id = await this.db.players.add(player)
    return { ...player, id }
  }
}
