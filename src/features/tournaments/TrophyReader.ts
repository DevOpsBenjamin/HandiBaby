import type { HandiBabyDatabase } from '@/core/db/database'
import { displayName } from '@/features/players/domain/naming'
import type { Player } from '@/features/players/domain/types'
import {
  bestAttacker,
  bestDefender,
  buildPlayerRecords,
  type PlayerRecord,
} from './domain/trophies'

export interface NamedRecord extends PlayerRecord {
  name: string
}

export interface TrophyBoard {
  defender: NamedRecord | null
  attacker: NamedRecord | null
  players: NamedRecord[]
}

/**
 * The trophies, at the two scales the rules describe.
 *
 * The cumulative board reads every edition held locally, abandoned ones
 * included: their matches were played, and dropping them would quietly rewrite
 * the all-time figures.
 */
export class TrophyReader {
  constructor(private readonly db: HandiBabyDatabase) {}

  async forEdition(tournamentId: number): Promise<TrophyBoard> {
    const [matches, roster] = await Promise.all([
      this.db.matches.where('tournamentId').equals(tournamentId).toArray(),
      this.#roster(tournamentId),
    ])

    return this.#board(matches, roster)
  }

  /** Every edition in the database, which is what makes a player measurable. */
  async cumulative(): Promise<TrophyBoard> {
    const [matches, pool] = await Promise.all([
      this.db.matches.toArray(),
      this.db.players.toArray(),
    ])

    return this.#board(matches, pool)
  }

  #board(matches: Parameters<typeof buildPlayerRecords>[0], scope: readonly Player[]): TrophyBoard {
    const records = buildPlayerRecords(matches)
    const named = records.map((record) => ({
      ...record,
      name: this.#name(record.playerId, scope),
    }))

    const defender = bestDefender(records)
    const attacker = bestAttacker(records)

    return {
      defender: named.find((record) => record.playerId === defender?.playerId) ?? null,
      attacker: named.find((record) => record.playerId === attacker?.playerId) ?? null,
      players: named,
    }
  }

  #name(playerId: number, scope: readonly Player[]): string {
    const player = scope.find((candidate) => (candidate.id ?? 0) === playerId)
    return player === undefined ? '—' : displayName(player, scope)
  }

  async #roster(tournamentId: number): Promise<Player[]> {
    const links = await this.db.tournamentPlayers
      .where('tournamentId')
      .equals(tournamentId)
      .toArray()
    const players = await this.db.players.bulkGet(links.map((link) => link.playerId))

    return players.filter((player): player is Player => player !== undefined)
  }
}
