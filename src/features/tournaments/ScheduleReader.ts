import type { HandiBabyDatabase } from '@/core/db/database'
import type { Player } from '@/features/players/domain/types'
import type { Match } from './domain/types'

export interface MatchSide {
  teamId: number
  teamLabel: string
  defender: Player | null
  attacker: Player | null
}

export interface MatchView {
  id: number
  /** Position in the calendar's reading order, identical on every device. */
  order: number
  /** Kept for the tie-break, not shown as a grouping. */
  duel: number
  rankInDuel: number
  blue: MatchSide
  white: MatchSide
  winnerTeamId: number | null
  loserScore: number | null
  played: boolean
}

export interface ScheduleProgress {
  playedMatches: number
  totalMatches: number
}

/**
 * Assembles what the screens need out of the flat match rows: who stands where,
 * and how far along the edition is.
 *
 * The planning unit is the match. Four named people are rarely free for four
 * matches running, and whoever is at the table should be able to play whatever
 * is left rather than the one pairing that needs someone who went home.
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
    const matches = await this.listMatches(tournamentId)

    return {
      playedMatches: matches.filter((match) => match.played).length,
      totalMatches: matches.length,
    }
  }

  /** Every round-robin match, in the order the calendar stored. */
  async listMatches(tournamentId: number): Promise<MatchView[]> {
    const { matches, teams, players } = await this.#load(tournamentId)

    return matches
      .map((match) => ({ match, position: readingPosition(match) }))
      .sort((left, right) => left.position - right.position)
      .map(({ match, position }) => ({
        id: match.id ?? 0,
        order: position,
        duel: match.duel ?? 0,
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
      }))
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
}

/**
 * Editions generated before the calendar carried a reading order fall back to
 * their duel grouping, which is what they were played in and is just as
 * deterministic on every device.
 */
function readingPosition(match: Match): number {
  return match.order ?? (match.duel ?? 0) * 100 + (match.rankInDuel ?? 0)
}
