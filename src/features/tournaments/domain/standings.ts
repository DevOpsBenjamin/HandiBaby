import { goalsFor, involves, playedRoundRobin, type PlayedMatch } from './score'
import type { Match } from './types'

export const POINTS_PER_WIN = 3

/**
 * Which rule put one team above another, in the order the format applies them.
 *
 * `head-to-head` before `goal-difference` is deliberate. In a group this small,
 * "we beat you three to one" is the least contestable argument there is, and it
 * rests on the four matches of a duel rather than on a single game.
 */
export type SeparationLevel =
  | 'points'
  | 'head-to-head'
  | 'head-to-head-goal-difference'
  | 'goal-difference'
  /** The cascade ran out. The rules hand this to the organisers. */
  | 'unresolved'

export interface TeamRecord {
  teamId: number
  played: number
  wins: number
  losses: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

export interface Standing extends TeamRecord {
  /** Shared with the team above when the cascade could not separate them. */
  rank: number
  /** The level that put this team above the next one. Null on the last row. */
  separation: SeparationLevel | null
}

export interface StandingsTable {
  rows: Standing[]
  /**
   * Teams the app refuses to order: three or more level on points and goal
   * difference, or two the cascade exhausted. Inventing a tie-break here would
   * decide a tournament on a rule nobody agreed to.
   */
  arbitration: number[][]
}

export interface Separation {
  /** Negative when the left team ranks above the right one. */
  order: number
  level: SeparationLevel
}

export function buildRecord(teamId: number, matches: readonly PlayedMatch[]): TeamRecord {
  let wins = 0
  let losses = 0
  let scored = 0
  let conceded = 0

  for (const match of matches) {
    if (!involves(match, teamId)) {
      continue
    }

    const opponent = match.winnerTeamId === teamId ? match.loserTeamId : match.winnerTeamId

    if (match.winnerTeamId === teamId) {
      wins += 1
    } else {
      losses += 1
    }

    scored += goalsFor(match, teamId)
    conceded += goalsFor(match, opponent)
  }

  return {
    teamId,
    played: wins + losses,
    wins,
    losses,
    points: wins * POINTS_PER_WIN,
    goalsFor: scored,
    goalsAgainst: conceded,
    goalDifference: scored - conceded,
  }
}

/** The four matches the two teams played against each other, and nothing else. */
function duelBetween(left: number, right: number, matches: readonly PlayedMatch[]): PlayedMatch[] {
  return matches.filter((match) => involves(match, left) && involves(match, right))
}

/**
 * Applies the cascade to two teams and reports which level decided it.
 *
 * The level is returned rather than kept private so the table can say why one
 * team sits above another instead of asking anyone to take it on trust.
 */
export function compareTeams(
  left: TeamRecord,
  right: TeamRecord,
  matches: readonly PlayedMatch[],
): Separation {
  if (left.points !== right.points) {
    return { order: right.points - left.points, level: 'points' }
  }

  const duel = duelBetween(left.teamId, right.teamId, matches)
  const leftWins = duel.filter((match) => match.winnerTeamId === left.teamId).length
  const rightWins = duel.length - leftWins

  if (leftWins !== rightWins) {
    return { order: rightWins - leftWins, level: 'head-to-head' }
  }

  const duelDifference = duel.reduce(
    (total, match) => total + goalsFor(match, left.teamId) - goalsFor(match, right.teamId),
    0,
  )

  if (duelDifference !== 0) {
    return { order: -duelDifference, level: 'head-to-head-goal-difference' }
  }

  if (left.goalDifference !== right.goalDifference) {
    return { order: right.goalDifference - left.goalDifference, level: 'goal-difference' }
  }

  return { order: 0, level: 'unresolved' }
}

/** Consecutive teams level on points and on general goal difference. */
function levelRuns(sorted: readonly TeamRecord[]): TeamRecord[][] {
  const runs: TeamRecord[][] = []

  for (const record of sorted) {
    const current = runs[runs.length - 1]
    const head = current?.[0]

    if (
      current !== undefined &&
      head !== undefined &&
      head.points === record.points &&
      head.goalDifference === record.goalDifference
    ) {
      current.push(record)
    } else {
      runs.push([record])
    }
  }

  return runs
}

/**
 * A run the app will not order.
 *
 * Two teams go to arbitration only once all four levels are exhausted. Three or
 * more level on points and goal difference go there straight away: the rules
 * define the duel record between two teams, and three teams can beat each other
 * in a circle, so there is nothing to apply.
 */
function isUndecided(run: readonly TeamRecord[], matches: readonly PlayedMatch[]): boolean {
  if (run.length >= 3) {
    return true
  }

  const [left, right] = run

  return (
    run.length === 2 &&
    left !== undefined &&
    right !== undefined &&
    compareTeams(left, right, matches).level === 'unresolved'
  )
}

export function buildStandings(
  teamIds: readonly number[],
  matches: readonly Match[],
): StandingsTable {
  const played = playedRoundRobin(matches)
  const records = teamIds.map((teamId) => buildRecord(teamId, played))

  // The team id only breaks a tie the cascade already gave up on, so the table
  // is stable between two reads rather than left to the sort implementation.
  const sorted = [...records].sort(
    (left, right) => compareTeams(left, right, played).order || left.teamId - right.teamId,
  )

  const arbitration: number[][] = []
  const ranks = new Map<number, number>()
  const groupOf = new Map<number, number>()

  let position = 1

  for (const run of levelRuns(sorted)) {
    const undecided = isUndecided(run, played)

    if (undecided) {
      arbitration.push(run.map((record) => record.teamId))
    }

    for (const [offset, record] of run.entries()) {
      ranks.set(record.teamId, undecided ? position : position + offset)

      if (undecided) {
        groupOf.set(record.teamId, arbitration.length - 1)
      }
    }

    position += run.length
  }

  const rows = sorted.map((record, index) => {
    const next = sorted[index + 1]

    return {
      ...record,
      rank: ranks.get(record.teamId) ?? index + 1,
      separation: next === undefined ? null : separationBetween(record, next, groupOf, played),
    }
  })

  return { rows, arbitration }
}

/** Inside an arbitration group nothing separated anyone, whatever a pairwise read would say. */
function separationBetween(
  left: TeamRecord,
  right: TeamRecord,
  groupOf: ReadonlyMap<number, number>,
  matches: readonly PlayedMatch[],
): SeparationLevel {
  const group = groupOf.get(left.teamId)

  if (group !== undefined && group === groupOf.get(right.teamId)) {
    return 'unresolved'
  }

  return compareTeams(left, right, matches).level
}
