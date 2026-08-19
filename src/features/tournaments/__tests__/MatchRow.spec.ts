import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MatchRow from '../components/MatchRow.vue'
import type { Player } from '@/features/players/domain/types'
import type { MatchView } from '../ScheduleReader'

const ROSTER: Player[] = [
  { id: 1, firstName: 'Alice', lastName: 'Dupont', nameKey: 'dupont alice' },
  { id: 2, firstName: 'Bob', lastName: 'Martin', nameKey: 'martin bob' },
  { id: 3, firstName: 'Charlie', lastName: 'Durand', nameKey: 'durand charlie' },
  { id: 4, firstName: 'David', lastName: 'Lefebvre', nameKey: 'lefebvre david' },
]

function makeMatch(overrides?: Partial<MatchView>): MatchView {
  return {
    id: 10,
    order: 0,
    duel: 0,
    rankInDuel: 0,
    blue: {
      teamId: 1,
      teamLabel: 'Les Aigles',
      defender: ROSTER[0] ?? null,
      attacker: ROSTER[1] ?? null,
    },
    white: {
      teamId: 2,
      teamLabel: 'Les Faucons',
      defender: ROSTER[2] ?? null,
      attacker: ROSTER[3] ?? null,
    },
    winnerTeamId: null,
    loserScore: null,
    played: false,
    ...overrides,
  }
}

describe('MatchRow', () => {
  it('renders team names at the top, player roles in parentheses, and side colors underneath', () => {
    const match = makeMatch()
    const wrapper = mount(MatchRow, {
      props: {
        match,
        roster: ROSTER,
        unlocked: true,
        busy: false,
        correcting: false,
        records: [],
      },
    })

    const text = wrapper.text()
    expect(text).toContain('Les Aigles')
    expect(text).toContain('Les Faucons')
    expect(text).toContain('Alice (défense) / Bob (attaque)')
    expect(text).toContain('Charlie (défense) / David (attaque)')
    expect(text).toContain('Bleu')
    expect(text).toContain('Blanc')

    // Ensure the old footer format "teamLabel, défense / attaque" is not present
    expect(text).not.toContain('Les Aigles, défense / attaque')
    expect(text).not.toContain('Les Faucons, défense / attaque')
  })
})
