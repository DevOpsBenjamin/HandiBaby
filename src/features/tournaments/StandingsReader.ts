import type { HandiBabyDatabase } from '@/core/db/database'
import { displayName } from '@/features/players/domain/naming'
import type { Player } from '@/features/players/domain/types'
import { bestConfiguration, type Configuration } from './domain/configurations'
import { computeSideStats, type OverallSideStats, type SideRecord } from './domain/sideStats'
import { buildStandings, type Standing } from './domain/standings'

export interface StandingRow extends Standing {
  teamLabel: string
  players: string
}

export interface ConfigurationOption extends Configuration {
  defender: string
  attacker: string
}

export interface ConfigurationRow {
  teamId: number
  teamLabel: string
  options: ConfigurationOption[]
  tied: boolean
}

export interface TeamSideStatRow {
  teamId: number
  teamLabel: string
  blue: SideRecord
  white: SideRecord
}

export interface StandingsView {
  rows: StandingRow[]
  configurations: ConfigurationRow[]
  /** Teams the cascade refused to order, named for the message that says so. */
  arbitration: string[][]
  sideStats: {
    overall: OverallSideStats
    teams: TeamSideStatRow[]
  }
}

/**
 * Assembles the standings screen. Nothing here is stored: the table is derived
 * from the match rows every time it is read, so it is current the moment a
 * score lands, with or without a network.
 */
export class StandingsReader {
  constructor(private readonly db: HandiBabyDatabase) {}

  async read(tournamentId: number): Promise<StandingsView> {
    const [matches, teams, roster] = await Promise.all([
      this.db.matches.where('tournamentId').equals(tournamentId).toArray(),
      this.db.teams.where('tournamentId').equals(tournamentId).toArray(),
      this.#roster(tournamentId),
    ])

    const players = new Map(roster.map((player) => [player.id ?? 0, player]))
    const labels = new Map(teams.map((team) => [team.id ?? 0, team.label]))
    const teamIds = teams.map((team) => team.id ?? 0)

    const name = (playerId: number): string => {
      const player = players.get(playerId)
      return player === undefined ? '—' : displayName(player, roster)
    }

    const table = buildStandings(teamIds, matches)
    const sideStats = computeSideStats(teamIds, matches)

    return {
      rows: table.rows.map((row) => {
        const team = teams.find((candidate) => (candidate.id ?? 0) === row.teamId)

        return {
          ...row,
          teamLabel: labels.get(row.teamId) ?? '',
          players:
            team === undefined ? '' : `${name(team.playerOneId)} et ${name(team.playerTwoId)}`,
        }
      }),

      configurations: teamIds.map((teamId) => {
        const choice = bestConfiguration(teamId, matches)

        return {
          teamId,
          teamLabel: labels.get(teamId) ?? '',
          options: choice.configurations.map((configuration) => ({
            ...configuration,
            defender: name(configuration.defenderId),
            attacker: name(configuration.attackerId),
          })),
          tied: choice.tied,
        }
      }),

      arbitration: table.arbitration.map((group) =>
        group.map((teamId) => labels.get(teamId) ?? ''),
      ),

      sideStats: {
        overall: sideStats.overall,
        teams: sideStats.teams.map((stat) => ({
          ...stat,
          teamLabel: labels.get(stat.teamId) ?? '',
        })),
      },
    }
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
