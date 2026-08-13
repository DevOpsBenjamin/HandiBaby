import type { HandiBabyDatabase } from '@/core/db/database'
import { buildBracket } from './domain/bracket'
import { bestConfiguration, type ConfigurationChoice } from './domain/configurations'
import type { FrozenConfiguration, FrozenEdition, FrozenStanding } from './domain/freeze'
import { buildStandings, type StandingsTable } from './domain/standings'
import type { Match, Tournament } from './domain/types'

export class NotInRoundRobinError extends Error {
  constructor() {
    super('Cette édition n’est pas en phase de classement')
    this.name = 'NotInRoundRobinError'
  }
}

export class MatchesStillOpenError extends Error {
  constructor(readonly remaining: number) {
    super(`Il reste ${remaining} match${remaining > 1 ? 's' : ''} de classement à saisir`)
    this.name = 'MatchesStillOpenError'
  }
}

/**
 * Raised rather than seeding a bracket on an order the rules did not produce.
 * The organisers settle it, which is exactly what the cascade asked for.
 */
export class ArbitrationPendingError extends Error {
  constructor() {
    super('Des équipes ne sont pas départagées : le classement doit être arbitré avant de figer')
    this.name = 'ArbitrationPendingError'
  }
}

export class ConfigurationChoiceRequiredError extends Error {
  constructor(readonly teamIds: readonly number[]) {
    super('Une équipe à configurations égales doit choisir la sienne')
    this.name = 'ConfigurationChoiceRequiredError'
  }
}

export interface ClosingPreview {
  standings: StandingsTable
  configurations: ConfigurationChoice[]
  remaining: number
  /** Teams whose two configurations are level, and which therefore have to pick. */
  awaitingChoice: number[]
  closable: boolean
}

/** Which configuration a team picked, by the id of the player who defends. */
export type ConfigurationChoices = Readonly<Record<number, number>>

/**
 * Ends the group phase, once, on a deliberate act.
 *
 * Everything the playoff is seeded from is written down at that instant instead
 * of being recomputed later, and round-robin matches stop accepting
 * corrections. There is no way back from here: reopening would invalidate
 * playoff matches already played, so the check belongs before the click rather
 * than after it.
 */
export class GroupPhase {
  constructor(private readonly db: HandiBabyDatabase) {}

  async preview(tournamentId: number): Promise<ClosingPreview> {
    const [matches, teams] = await Promise.all([
      this.db.matches.where('tournamentId').equals(tournamentId).toArray(),
      this.db.teams.where('tournamentId').equals(tournamentId).toArray(),
    ])

    const roundRobin = matches.filter((match) => match.phase === 'round-robin')
    const remaining = roundRobin.filter((match) => match.winnerTeamId === null).length

    const standings = buildStandings(
      teams.map((team) => team.id ?? 0),
      matches,
    )
    const configurations = teams.map((team) => bestConfiguration(team.id ?? 0, matches))
    const awaitingChoice = configurations.filter((row) => row.tied).map((row) => row.teamId)

    return {
      standings,
      configurations,
      remaining,
      awaitingChoice,
      closable: remaining === 0 && standings.arbitration.length === 0,
    }
  }

  async close(tournament: Tournament, choices: ConfigurationChoices = {}): Promise<FrozenEdition> {
    const tournamentId = tournament.id ?? 0

    return this.db.transaction(
      'rw',
      [this.db.tournaments, this.db.teams, this.db.matches, this.db.frozenEditions],
      async () => {
        const current = await this.db.tournaments.get(tournamentId)

        // Read from the row rather than the caller's copy: the only thing that
        // makes closing twice impossible is checking the state that changed.
        if (current === undefined || current.status !== 'round-robin') {
          throw new NotInRoundRobinError()
        }

        const [matches, teams] = await Promise.all([
          this.db.matches.where('tournamentId').equals(tournamentId).toArray(),
          this.db.teams.where('tournamentId').equals(tournamentId).toArray(),
        ])

        const remaining = matches.filter(
          (match) => match.phase === 'round-robin' && match.winnerTeamId === null,
        ).length

        if (remaining > 0) {
          throw new MatchesStillOpenError(remaining)
        }

        const teamIds = teams.map((team) => team.id ?? 0)
        const table = buildStandings(teamIds, matches)

        if (table.arbitration.length > 0) {
          throw new ArbitrationPendingError()
        }

        const configurations = this.#resolveConfigurations(teamIds, matches, choices)

        const frozen: FrozenEdition = {
          tournamentId,
          standings: table.rows.map((row): FrozenStanding => ({
            rank: row.rank,
            teamId: row.teamId,
            played: row.played,
            wins: row.wins,
            losses: row.losses,
            points: row.points,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            goalDifference: row.goalDifference,
            separation: row.separation,
          })),
          configurations,
          bracket: buildBracket(teamIds.length),
          frozenAt: Date.now(),
        }

        await this.db.frozenEditions.add(frozen)
        await this.db.tournaments.update(tournamentId, { status: 'playoff' })

        return frozen
      },
    )
  }

  async readFrozen(tournamentId: number): Promise<FrozenEdition | undefined> {
    return this.db.frozenEditions.get(tournamentId)
  }

  #resolveConfigurations(
    teamIds: readonly number[],
    matches: readonly Match[],
    choices: ConfigurationChoices,
  ): FrozenConfiguration[] {
    const resolved: FrozenConfiguration[] = []
    const missing: number[] = []

    for (const teamId of teamIds) {
      const choice = bestConfiguration(teamId, matches)
      const picked = choices[teamId]

      // A level pair is the team's call, and the rules give it to nobody else.
      const configuration = choice.tied
        ? choice.configurations.find((option) => option.defenderId === picked)
        : choice.configurations[0]

      if (configuration === undefined) {
        missing.push(teamId)
        continue
      }

      resolved.push({
        teamId,
        defenderId: configuration.defenderId,
        attackerId: configuration.attackerId,
        chosen: choice.tied,
      })
    }

    if (missing.length > 0) {
      throw new ConfigurationChoiceRequiredError(missing)
    }

    return resolved
  }
}
