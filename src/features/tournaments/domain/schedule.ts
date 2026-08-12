import type { GeneratedMatch, ScheduleTeam } from './types'

/**
 * The four matches of a duel, as specified in RULES.BABY.MD.
 *
 *   RENCONTRE            EQUIPE X   EQUIPE Y
 *   1     P1/P2  vs  Q1/Q2       nord       sud
 *   2     P1/P2  vs  Q2/Q1       sud        nord
 *   3     P2/P1  vs  Q2/Q1       nord       sud
 *   4     P2/P1  vs  Q1/Q2       sud        nord
 *
 * Two rules are encoded here: exactly one of the two teams swaps its
 * positions between consecutive matches, and everyone changes end every match.
 */
const DUEL_PATTERN = [
  { homeSwapped: false, awaySwapped: false, homeAtNorth: true },
  { homeSwapped: false, awaySwapped: true, homeAtNorth: false },
  { homeSwapped: true, awaySwapped: true, homeAtNorth: true },
  { homeSwapped: true, awaySwapped: false, homeAtNorth: false },
] as const

export const MATCHES_PER_DUEL = DUEL_PATTERN.length

/** Returns [defender, attacker] for a team, swapped or not. */
function positions(team: ScheduleTeam, swapped: boolean): readonly [number, number] {
  const [first, second] = team.players
  return swapped ? [second, first] : [first, second]
}

/**
 * Builds the complete round-robin schedule: every pair of teams meets in a
 * duel, and every duel explores the four position combinations.
 *
 * The whole calendar is generated up front, ends and positions included, so
 * the balances hold whatever order the duels are actually played in.
 */
export function generateRoundRobin(teams: readonly ScheduleTeam[]): GeneratedMatch[] {
  if (teams.length < 3 || teams.length > 4) {
    throw new Error(`A tournament needs 3 or 4 teams, received ${teams.length}`)
  }

  const matches: GeneratedMatch[] = []
  let duel = 0

  for (let home = 0; home < teams.length; home += 1) {
    for (let away = home + 1; away < teams.length; away += 1) {
      const homeTeam = teams[home]
      const awayTeam = teams[away]

      if (homeTeam === undefined || awayTeam === undefined) {
        continue
      }

      duel += 1

      DUEL_PATTERN.forEach((step, index) => {
        const [homeDefender, homeAttacker] = positions(homeTeam, step.homeSwapped)
        const [awayDefender, awayAttacker] = positions(awayTeam, step.awaySwapped)

        matches.push({
          phase: 'round-robin',
          duel,
          rankInDuel: index + 1,
          northTeamId: step.homeAtNorth ? homeTeam.id : awayTeam.id,
          southTeamId: step.homeAtNorth ? awayTeam.id : homeTeam.id,
          northDefenderId: step.homeAtNorth ? homeDefender : awayDefender,
          northAttackerId: step.homeAtNorth ? homeAttacker : awayAttacker,
          southDefenderId: step.homeAtNorth ? awayDefender : homeDefender,
          southAttackerId: step.homeAtNorth ? awayAttacker : homeAttacker,
          winnerTeamId: null,
          loserScore: null,
          enteredAt: null,
        })
      })
    }
  }

  return matches
}
