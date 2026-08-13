import type { HandiBabyDatabase } from '@/core/db/database'
import type { TeamComposition } from './domain/draw'
import { generateRoundRobin } from './domain/schedule'
import type { ScheduleTeam, Team } from './domain/types'

export class UnknownTournamentError extends Error {
  constructor() {
    super('Cette édition est introuvable')
    this.name = 'UnknownTournamentError'
  }
}

export class NotADraftError extends Error {
  constructor() {
    super('Cette édition a déjà démarré')
    this.name = 'NotADraftError'
  }
}

export class ScheduleAlreadyGeneratedError extends Error {
  constructor() {
    super('Le calendrier de cette édition est déjà engendré')
    this.name = 'ScheduleAlreadyGeneratedError'
  }
}

export class CompositionMismatchError extends Error {
  constructor() {
    super('Les équipes ne correspondent pas aux joueurs inscrits')
    this.name = 'CompositionMismatchError'
  }
}

/**
 * Closes the setup of an edition: writes the teams, generates the whole
 * calendar, and starts the round robin.
 *
 * All of it in one transaction. A half-created edition, teams without a
 * calendar or the reverse, is not a state anything downstream could recover
 * from.
 */
export class TournamentSetup {
  constructor(private readonly db: HandiBabyDatabase) {}

  async start(tournamentId: number, compositions: readonly TeamComposition[]): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.tournaments, this.db.tournamentPlayers, this.db.teams, this.db.matches],
      async () => {
        const tournament = await this.db.tournaments.get(tournamentId)

        if (tournament === undefined) {
          throw new UnknownTournamentError()
        }

        if (tournament.status !== 'draft') {
          throw new NotADraftError()
        }

        // Regenerating would orphan any score already attached to a match, and
        // that is not a recoverable state.
        const existing = await this.db.matches.where('tournamentId').equals(tournamentId).count()

        if (existing > 0) {
          throw new ScheduleAlreadyGeneratedError()
        }

        await this.#assertCoversRoster(tournamentId, compositions)

        const teams: Team[] = compositions.map((composition) => ({
          tournamentId,
          label: composition.label,
          playerOneId: composition.players[0],
          playerTwoId: composition.players[1],
        }))

        const teamIds = await this.db.teams.bulkAdd(teams, { allKeys: true })

        const scheduleTeams: ScheduleTeam[] = compositions.map((composition, index) => {
          const id = teamIds[index]

          if (id === undefined) {
            throw new Error('Team was not persisted')
          }

          return { id, players: composition.players }
        })

        const matches = generateRoundRobin(scheduleTeams).map((match) => ({
          ...match,
          tournamentId,
        }))

        await this.db.matches.bulkAdd(matches)
        await this.db.tournaments.update(tournamentId, { status: 'round-robin' })
      },
    )
  }

  /** Every participant plays, and only participants play. */
  async #assertCoversRoster(
    tournamentId: number,
    compositions: readonly TeamComposition[],
  ): Promise<void> {
    const roster = await this.db.tournamentPlayers
      .where('tournamentId')
      .equals(tournamentId)
      .toArray()
    const expected = new Set(roster.map((link) => link.playerId))
    const composed = compositions.flatMap((composition) => [...composition.players])

    const covers =
      composed.length === expected.size &&
      new Set(composed).size === composed.length &&
      composed.every((playerId) => expected.has(playerId))

    if (!covers) {
      throw new CompositionMismatchError()
    }
  }
}
