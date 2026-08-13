import { goalsFor, playedRoundRobin } from './score'
import type { Match } from './types'

export interface PlayerRecord {
  playerId: number
  matchesDefended: number
  goalsConceded: number
  matchesAttacked: number
  goalsScored: number
  /** Null until the player has actually held that post. */
  concededPerMatch: number | null
  scoredPerMatch: number | null
}

interface Tally {
  matchesDefended: number
  goalsConceded: number
  matchesAttacked: number
  goalsScored: number
}

function blank(): Tally {
  return { matchesDefended: 0, goalsConceded: 0, matchesAttacked: 0, goalsScored: 0 }
}

/**
 * What each player did at each post, over the round-robin matches only.
 *
 * A defender is measured on what the other side put past them, an attacker on
 * what their own side put in. Both are averages rather than totals, so somebody
 * who played more matches is not rewarded for the volume.
 */
export function buildPlayerRecords(matches: readonly Match[]): PlayerRecord[] {
  const tallies = new Map<number, Tally>()

  const tally = (playerId: number): Tally => {
    const current = tallies.get(playerId) ?? blank()
    tallies.set(playerId, current)
    return current
  }

  for (const match of playedRoundRobin(matches)) {
    const sides = [
      {
        defenderId: match.blueDefenderId,
        attackerId: match.blueAttackerId,
        scored: goalsFor(match, match.blueTeamId),
        conceded: goalsFor(match, match.whiteTeamId),
      },
      {
        defenderId: match.whiteDefenderId,
        attackerId: match.whiteAttackerId,
        scored: goalsFor(match, match.whiteTeamId),
        conceded: goalsFor(match, match.blueTeamId),
      },
    ]

    for (const side of sides) {
      const defender = tally(side.defenderId)
      defender.matchesDefended += 1
      defender.goalsConceded += side.conceded

      const attacker = tally(side.attackerId)
      attacker.matchesAttacked += 1
      attacker.goalsScored += side.scored
    }
  }

  return [...tallies.entries()]
    .map(([playerId, counts]) => ({
      playerId,
      ...counts,
      concededPerMatch:
        counts.matchesDefended === 0 ? null : counts.goalsConceded / counts.matchesDefended,
      scoredPerMatch:
        counts.matchesAttacked === 0 ? null : counts.goalsScored / counts.matchesAttacked,
    }))
    .sort((left, right) => left.playerId - right.playerId)
}

/** Lowest average conceded while defending. */
export function bestDefender(records: readonly PlayerRecord[]): PlayerRecord | null {
  return best(records, (record) =>
    record.concededPerMatch === null ? null : -record.concededPerMatch,
  )
}

/** Highest average scored while attacking. */
export function bestAttacker(records: readonly PlayerRecord[]): PlayerRecord | null {
  return best(records, (record) => record.scoredPerMatch)
}

/** Highest score wins; the player id only breaks a tie, so two reads agree. */
function best(
  records: readonly PlayerRecord[],
  score: (record: PlayerRecord) => number | null,
): PlayerRecord | null {
  let leader: PlayerRecord | null = null
  let leading = Number.NEGATIVE_INFINITY

  for (const record of records) {
    const value = score(record)

    if (value === null) {
      continue
    }

    if (leader === null || value > leading) {
      leader = record
      leading = value
    }
  }

  return leader
}
