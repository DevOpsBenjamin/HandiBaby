import type { GeneratedMatch, ScheduleTeam } from './types'

/**
 * The four matches of a duel, as specified in RULES.BABY.MD. The two sides of
 * the table are named after their rods: what the document calls nord and sud
 * is blue and white here, which is what players actually say at the table.
 *
 *   RENCONTRE            EQUIPE X   EQUIPE Y
 *   1     P1/P2  vs  Q1/Q2       bleu       blanc
 *   2     P1/P2  vs  Q2/Q1       blanc      bleu
 *   3     P2/P1  vs  Q2/Q1       bleu       blanc
 *   4     P2/P1  vs  Q1/Q2       blanc      bleu
 *
 * Two rules are encoded here: exactly one of the two teams swaps its positions
 * between consecutive matches, and everyone changes side every match.
 */
const DUEL_PATTERN = [
  { homeSwapped: false, awaySwapped: false, homeAtBlue: true },
  { homeSwapped: false, awaySwapped: true, homeAtBlue: false },
  { homeSwapped: true, awaySwapped: true, homeAtBlue: true },
  { homeSwapped: true, awaySwapped: false, homeAtBlue: false },
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
 * The whole calendar is generated up front, sides and positions included, so
 * the balances hold whatever order the duels are actually played in.
 */
/**
 * Spreads each duel's four matches across the calendar instead of leaving them
 * in a block, by taking the first match of every duel, then the second, and so
 * on. Two consecutive matches therefore never come from the same duel, so a
 * pairing no longer monopolises an hour of the table.
 *
 * With three teams every duel shares a team with both others, so back-to-back
 * matches will still share players. That is arithmetic, not something to fix.
 */
function interleaveDuels(matches: readonly GeneratedMatch[]): GeneratedMatch[] {
  const byRank = new Map<number, GeneratedMatch[]>()

  for (const match of matches) {
    const rank = match.rankInDuel ?? 0
    byRank.set(rank, [...(byRank.get(rank) ?? []), match])
  }

  return [...byRank.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([, group]) => group)
    .map((match, index) => ({ ...match, order: index }))
}

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
          blueTeamId: step.homeAtBlue ? homeTeam.id : awayTeam.id,
          whiteTeamId: step.homeAtBlue ? awayTeam.id : homeTeam.id,
          blueDefenderId: step.homeAtBlue ? homeDefender : awayDefender,
          blueAttackerId: step.homeAtBlue ? homeAttacker : awayAttacker,
          whiteDefenderId: step.homeAtBlue ? awayDefender : homeDefender,
          whiteAttackerId: step.homeAtBlue ? awayAttacker : homeAttacker,
          winnerTeamId: null,
          loserScore: null,
          enteredAt: null,
        })
      })
    }
  }

  return interleaveDuels(matches)
}
