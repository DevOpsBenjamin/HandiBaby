import type { HandiBabyDatabase } from '@/core/db/database'
import { defaultTeamLabel, resolveRename } from './domain/teamNames'
import type { Team } from './domain/types'

export class UnknownTeamError extends Error {
  constructor() {
    super('Cette équipe est introuvable dans cette édition')
    this.name = 'UnknownTeamError'
  }
}

/**
 * Team names, which are printed everywhere and referenced nowhere.
 *
 * Nicknames get invented several duels in, so renaming stays possible for the
 * whole life of an edition, frozen group phase included. Everything downstream
 * keys on the team id: the standings, the configurations and the bracket are
 * stored against ids, so a rename changes what is printed and nothing else.
 */
export class TeamRepository {
  constructor(private readonly db: HandiBabyDatabase) {}

  async list(tournamentId: number): Promise<Team[]> {
    const teams = await this.db.teams.where('tournamentId').equals(tournamentId).toArray()
    return teams.sort((left, right) => (left.id ?? 0) - (right.id ?? 0))
  }

  async rename(tournamentId: number, teamId: number, name: string): Promise<string> {
    const teams = await this.list(tournamentId)
    const index = teams.findIndex((team) => (team.id ?? 0) === teamId)
    const team = teams[index]

    if (team === undefined) {
      throw new UnknownTeamError()
    }

    // Blank means "no nickname", which is the numbered default rather than an
    // empty cell in the standings.
    const label = resolveRename(
      name,
      defaultTeamLabel(index),
      teams.filter((other) => (other.id ?? 0) !== teamId).map((other) => other.label),
    )

    await this.db.teams.update(teamId, { label })
    return label
  }
}
