import { describe, expect, it } from 'vitest'
import { MATCHES_PER_DUEL, generateRoundRobin } from '../schedule'
import type { GeneratedMatch, ScheduleTeam } from '../types'

/** Teams 1..n, players numbered 11/12, 21/22, ... so failures read easily. */
function buildTeams(count: number): ScheduleTeam[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    players: [(index + 1) * 10 + 1, (index + 1) * 10 + 2] as const,
  }))
}

function sideOf(match: GeneratedMatch, teamId: number): 'blue' | 'white' {
  return match.blueTeamId === teamId ? 'blue' : 'white'
}

function involves(match: GeneratedMatch, teamId: number): boolean {
  return match.blueTeamId === teamId || match.whiteTeamId === teamId
}

/** The team's ordering for this match, as "defender/attacker". */
function configOf(match: GeneratedMatch, teamId: number): string {
  return sideOf(match, teamId) === 'blue'
    ? `${match.blueDefenderId}/${match.blueAttackerId}`
    : `${match.whiteDefenderId}/${match.whiteAttackerId}`
}

function positionOf(match: GeneratedMatch, playerId: number): 'defence' | 'attack' | null {
  if (match.blueDefenderId === playerId || match.whiteDefenderId === playerId) {
    return 'defence'
  }
  if (match.blueAttackerId === playerId || match.whiteAttackerId === playerId) {
    return 'attack'
  }
  return null
}

function count<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length
}

describe('generateRoundRobin', () => {
  it('refuses team counts the format does not support', () => {
    expect(() => generateRoundRobin(buildTeams(2))).toThrow(/3 or 4 teams/)
    expect(() => generateRoundRobin(buildTeams(5))).toThrow(/3 or 4 teams/)
  })

  // The volumetry table of RULES.BABY.MD, asserted verbatim.
  it.each([
    { teamCount: 3, duels: 3, matches: 12, perTeam: 8, perPlayer: 8, perConfiguration: 4 },
    { teamCount: 4, duels: 6, matches: 24, perTeam: 12, perPlayer: 12, perConfiguration: 6 },
  ])(
    'produces $duels duels and $matches matches for $teamCount teams',
    ({ teamCount, duels, matches, perTeam, perPlayer, perConfiguration }) => {
      const teams = buildTeams(teamCount)
      const schedule = generateRoundRobin(teams)

      expect(schedule).toHaveLength(matches)
      expect(new Set(schedule.map((match) => match.duel)).size).toBe(duels)
      expect(duels * MATCHES_PER_DUEL).toBe(matches)

      for (const team of teams) {
        const played = schedule.filter((match) => involves(match, team.id))
        expect(played).toHaveLength(perTeam)

        for (const player of team.players) {
          expect(count(played, (match) => positionOf(match, player) !== null)).toBe(perPlayer)
        }

        const configurations = new Set(played.map((match) => configOf(match, team.id)))
        expect(configurations.size).toBe(2)
        for (const configuration of configurations) {
          expect(count(played, (match) => configOf(match, team.id) === configuration)).toBe(
            perConfiguration,
          )
        }
      }
    },
  )

  it.each([3, 4])('keeps every balance inside each duel, with %i teams', (teamCount) => {
    const teams = buildTeams(teamCount)
    const schedule = generateRoundRobin(teams)
    const duels = [...new Set(schedule.map((match) => match.duel))]

    for (const duel of duels) {
      const inDuel = schedule.filter((match) => match.duel === duel)
      expect(inDuel).toHaveLength(MATCHES_PER_DUEL)

      const teamIds = [...new Set(inDuel.flatMap((match) => [match.blueTeamId, match.whiteTeamId]))]
      expect(teamIds).toHaveLength(2)

      for (const teamId of teamIds) {
        const team = teams.find((candidate) => candidate.id === teamId)
        expect(team).toBeDefined()
        if (team === undefined) {
          continue
        }

        // Each team plays as many matches on each side.
        expect(count(inDuel, (match) => sideOf(match, teamId) === 'blue')).toBe(2)
        expect(count(inDuel, (match) => sideOf(match, teamId) === 'white')).toBe(2)

        // Each player plays as many matches at each position.
        for (const player of team.players) {
          expect(count(inDuel, (match) => positionOf(match, player) === 'defence')).toBe(2)
          expect(count(inDuel, (match) => positionOf(match, player) === 'attack')).toBe(2)
        }

        // Each configuration is played once on each side. This is the one that
        // keeps "our best configuration" from measuring the side of the table.
        for (const configuration of new Set(inDuel.map((match) => configOf(match, teamId)))) {
          const played = inDuel.filter((match) => configOf(match, teamId) === configuration)
          expect(played).toHaveLength(2)
          expect(new Set(played.map((match) => sideOf(match, teamId))).size).toBe(2)
        }
      }
    }
  })

  it('swaps exactly one team between consecutive matches, and changes sides every match', () => {
    const teams = buildTeams(4)
    const schedule = generateRoundRobin(teams)

    for (const duel of new Set(schedule.map((match) => match.duel))) {
      const inDuel = schedule
        .filter((match) => match.duel === duel)
        .sort((left, right) => (left.rankInDuel ?? 0) - (right.rankInDuel ?? 0))

      const [homeId, awayId] = [...new Set(inDuel.flatMap((m) => [m.blueTeamId, m.whiteTeamId]))]
      expect(homeId).toBeDefined()
      expect(awayId).toBeDefined()
      if (homeId === undefined || awayId === undefined) {
        continue
      }

      for (let index = 1; index < inDuel.length; index += 1) {
        const previous = inDuel[index - 1]
        const current = inDuel[index]
        expect(previous).toBeDefined()
        expect(current).toBeDefined()
        if (previous === undefined || current === undefined) {
          continue
        }

        const homeSwapped = configOf(previous, homeId) !== configOf(current, homeId)
        const awaySwapped = configOf(previous, awayId) !== configOf(current, awayId)
        expect(homeSwapped !== awaySwapped).toBe(true)

        expect(sideOf(current, homeId)).not.toBe(sideOf(previous, homeId))
        expect(sideOf(current, awayId)).not.toBe(sideOf(previous, awayId))
      }
    }
  })

  it('leaves every match unplayed and numbers them 1 to 4 inside a duel', () => {
    const schedule = generateRoundRobin(buildTeams(3))

    expect(schedule.every((match) => match.phase === 'round-robin')).toBe(true)
    expect(schedule.every((match) => match.winnerTeamId === null)).toBe(true)
    expect(schedule.every((match) => match.loserScore === null)).toBe(true)
    expect(schedule.every((match) => match.enteredAt === null)).toBe(true)

    for (const duel of new Set(schedule.map((match) => match.duel))) {
      const ranks = schedule
        .filter((match) => match.duel === duel)
        .map((match) => match.rankInDuel)
        .sort()
      expect(ranks).toEqual([1, 2, 3, 4])
    }
  })

  it('never puts a player on both sides of the same match', () => {
    for (const teamCount of [3, 4]) {
      for (const match of generateRoundRobin(buildTeams(teamCount))) {
        const onTable = [
          match.blueDefenderId,
          match.blueAttackerId,
          match.whiteDefenderId,
          match.whiteAttackerId,
        ]
        expect(new Set(onTable).size).toBe(4)
        expect(match.blueTeamId).not.toBe(match.whiteTeamId)
      }
    }
  })
})
