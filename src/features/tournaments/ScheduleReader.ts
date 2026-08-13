import type { HandiBabyDatabase } from '@/core/db/database'
import type { Player } from '@/features/players/domain/types'
import { MATCHES_PER_DUEL } from './domain/schedule'
import type { Match } from './domain/types'

export interface DuelTeam {
  id: number
  label: string
  players: Player[]
}

export interface DuelSummary {
  duel: number
  teams: DuelTeam[]
  playedMatches: number
  totalMatches: number
  complete: boolean
}

export interface MatchSide {
  teamId: number
  teamLabel: string
  defender: Player | null
  attacker: Player | null
}

export interface MatchView {
  id: number
  rankInDuel: number
  blue: MatchSide
  white: MatchSide
  winnerTeamId: number | null
  loserScore: number | null
  played: boolean
}

export interface DuelDetail {
  duel: number
  teams: DuelTeam[]
  matches: MatchView[]
}

export interface ScheduleProgress {
  playedDuels: number
  totalDuels: number
  playedMatches: number
  totalMatches: number
}

/**
 * Assembles what the screens need out of the flat match rows: who is in a duel,
 * how far along it is, and who stands where in each match.
 *
 * The planning unit is the duel, not the match. A duel needs four named people
 * around the table at the same time, which is why the list is read by names.
 */
export class ScheduleReader {
  constructor(private readonly db: HandiBabyDatabase) {}

  async roster(tournamentId: number): Promise<Player[]> {
    const links = await this.db.tournamentPlayers
      .where('tournamentId')
      .equals(tournamentId)
      .toArray()
    const players = await this.db.players.bulkGet(links.map((link) => link.playerId))
    return players.filter((player): player is Player => player !== undefined)
  }

  async progress(tournamentId: number): Promise<ScheduleProgress> {
    const duels = await this.listDuels(tournamentId)

    return {
      playedDuels: duels.filter((duel) => duel.complete).length,
      totalDuels: duels.length,
      playedMatches: duels.reduce((total, duel) => total + duel.playedMatches, 0),
      totalMatches: duels.reduce((total, duel) => total + duel.totalMatches, 0),
    }
  }

  async listDuels(tournamentId: number): Promise<DuelSummary[]> {
    const { matches, teams, players } = await this.#load(tournamentId)
    const byDuel = new Map<number, Match[]>()

    for (const match of matches) {
      if (match.duel === null) {
        continue
      }
      byDuel.set(match.duel, [...(byDuel.get(match.duel) ?? []), match])
    }

    return [...byDuel.entries()]
      .sort(([left], [right]) => left - right)
      .map(([duel, duelMatches]) => {
        const teamIds = [
          ...new Set(duelMatches.flatMap((match) => [match.blueTeamId, match.whiteTeamId])),
        ]
        const playedMatches = duelMatches.filter((match) => match.winnerTeamId !== null).length

        return {
          duel,
          teams: teamIds.map((id) => this.#team(id, teams, players)),
          playedMatches,
          totalMatches: duelMatches.length,
          complete: playedMatches === MATCHES_PER_DUEL,
        }
      })
  }

  async readDuel(tournamentId: number, duel: number): Promise<DuelDetail | null> {
    const { matches, teams, players } = await this.#load(tournamentId)
    const duelMatches = matches
      .filter((match) => match.duel === duel)
      .sort((left, right) => (left.rankInDuel ?? 0) - (right.rankInDuel ?? 0))

    if (duelMatches.length === 0) {
      return null
    }

    const teamIds = [
      ...new Set(duelMatches.flatMap((match) => [match.blueTeamId, match.whiteTeamId])),
    ]

    return {
      duel,
      teams: teamIds.map((id) => this.#team(id, teams, players)),
      matches: duelMatches.map((match) => ({
        id: match.id ?? 0,
        rankInDuel: match.rankInDuel ?? 0,
        blue: {
          teamId: match.blueTeamId,
          teamLabel: teams.get(match.blueTeamId)?.label ?? '',
          defender: players.get(match.blueDefenderId) ?? null,
          attacker: players.get(match.blueAttackerId) ?? null,
        },
        white: {
          teamId: match.whiteTeamId,
          teamLabel: teams.get(match.whiteTeamId)?.label ?? '',
          defender: players.get(match.whiteDefenderId) ?? null,
          attacker: players.get(match.whiteAttackerId) ?? null,
        },
        winnerTeamId: match.winnerTeamId,
        loserScore: match.loserScore,
        played: match.winnerTeamId !== null,
      })),
    }
  }

  async #load(tournamentId: number) {
    const [matches, teamRows, players] = await Promise.all([
      this.db.matches.where('tournamentId').equals(tournamentId).toArray(),
      this.db.teams.where('tournamentId').equals(tournamentId).toArray(),
      this.roster(tournamentId),
    ])

    return {
      matches: matches.filter((match) => match.phase === 'round-robin'),
      teams: new Map(teamRows.map((team) => [team.id ?? 0, team])),
      players: new Map(players.map((player) => [player.id ?? 0, player])),
    }
  }

  #team(
    id: number,
    teams: Map<number, { label: string; playerOneId: number; playerTwoId: number }>,
    players: Map<number, Player>,
  ): DuelTeam {
    const team = teams.get(id)

    return {
      id,
      label: team?.label ?? '',
      players: [team?.playerOneId, team?.playerTwoId]
        .map((playerId) => (playerId === undefined ? undefined : players.get(playerId)))
        .filter((player): player is Player => player !== undefined),
    }
  }
}
