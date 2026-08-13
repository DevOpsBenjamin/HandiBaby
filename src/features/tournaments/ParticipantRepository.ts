import type { HandiBabyDatabase } from '@/core/db/database'
import type { Player } from '@/features/players/domain/types'

export class AlreadyParticipatingError extends Error {
  constructor(player: Player) {
    super(`${player.firstName} ${player.lastName} participe déjà à cette édition`)
    this.name = 'AlreadyParticipatingError'
  }
}

export class UnknownPlayerError extends Error {
  constructor(playerId: number) {
    super(`Joueur ${playerId} introuvable dans le vivier`)
    this.name = 'UnknownPlayerError'
  }
}

/**
 * Who is playing this edition. The pool is permanent; participation is not, and
 * that separation is what lets pairs be mixed from one edition to the next.
 */
export class ParticipantRepository {
  constructor(private readonly db: HandiBabyDatabase) {}

  async list(tournamentId: number): Promise<Player[]> {
    const links = await this.db.tournamentPlayers
      .where('tournamentId')
      .equals(tournamentId)
      .toArray()
    const players = await this.db.players.bulkGet(links.map((link) => link.playerId))

    return players
      .filter((player): player is Player => player !== undefined)
      .sort((left, right) => left.nameKey.localeCompare(right.nameKey, 'fr'))
  }

  async add(tournamentId: number, playerId: number): Promise<Player> {
    const player = await this.db.players.get(playerId)

    if (player === undefined) {
      throw new UnknownPlayerError(playerId)
    }

    const existing = await this.db.tournamentPlayers
      .where('[tournamentId+playerId]')
      .equals([tournamentId, playerId])
      .first()

    if (existing !== undefined) {
      throw new AlreadyParticipatingError(player)
    }

    await this.db.tournamentPlayers.add({ tournamentId, playerId })
    return player
  }

  async remove(tournamentId: number, playerId: number): Promise<void> {
    await this.db.tournamentPlayers
      .where('[tournamentId+playerId]')
      .equals([tournamentId, playerId])
      .delete()
  }
}
