import { goalsFor, involves, playedRoundRobin, type PlayedMatch } from './score'
import type { Match } from './types'

/** One of a team's two ways of standing: who defends, who attacks. */
export interface Configuration {
  defenderId: number
  attackerId: number
  played: number
  wins: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

export interface ConfigurationChoice {
  teamId: number
  /** Best first. Empty until the team has played. */
  configurations: Configuration[]
  /**
   * True when the two are exactly level on wins and goal difference. The rules
   * give that choice to the team itself, so the app does not invent a
   * tie-break it was never granted.
   */
  tied: boolean
}

function postsOf(match: PlayedMatch, teamId: number): { defenderId: number; attackerId: number } {
  return match.blueTeamId === teamId
    ? { defenderId: match.blueDefenderId, attackerId: match.blueAttackerId }
    : { defenderId: match.whiteDefenderId, attackerId: match.whiteAttackerId }
}

/**
 * Which of a team's two configurations has actually been working, on wins first
 * and goal difference second.
 *
 * The duel pattern plays every configuration as often at each end of the table,
 * so this measures the pairing rather than the end of the room it was played
 * at. It decides the playoff line-up, which is why that balance matters.
 */
export function bestConfiguration(teamId: number, matches: readonly Match[]): ConfigurationChoice {
  const played = playedRoundRobin(matches)
  const byPosts = new Map<string, Configuration>()

  for (const match of played) {
    if (!involves(match, teamId)) {
      continue
    }

    const posts = postsOf(match, teamId)
    const opponent = match.winnerTeamId === teamId ? match.loserTeamId : match.winnerTeamId
    const key = `${posts.defenderId}-${posts.attackerId}`

    const current = byPosts.get(key) ?? {
      ...posts,
      played: 0,
      wins: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
    }

    current.played += 1
    current.wins += match.winnerTeamId === teamId ? 1 : 0
    current.goalsFor += goalsFor(match, teamId)
    current.goalsAgainst += goalsFor(match, opponent)
    current.goalDifference = current.goalsFor - current.goalsAgainst

    byPosts.set(key, current)
  }

  const configurations = [...byPosts.values()].sort(
    (left, right) =>
      right.wins - left.wins ||
      right.goalDifference - left.goalDifference ||
      left.defenderId - right.defenderId,
  )

  const [best, other] = configurations

  return {
    teamId,
    configurations,
    tied:
      best !== undefined &&
      other !== undefined &&
      best.wins === other.wins &&
      best.goalDifference === other.goalDifference,
  }
}
