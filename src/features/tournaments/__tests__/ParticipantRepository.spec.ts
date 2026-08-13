import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { PlayerRepository } from '@/features/players/PlayerRepository'
import type { Player } from '@/features/players/domain/types'
import {
  AlreadyParticipatingError,
  ParticipantRepository,
  UnknownPlayerError,
} from '../ParticipantRepository'
import { TournamentRepository } from '../TournamentRepository'

const EDITION = {
  label: 'Tournoi de printemps',
  startDate: '2026-08-13',
  passphrase: 'babyfoot du mardi',
}

let open: HandiBabyDatabase | null = null

async function build() {
  open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)

  const tournaments = new TournamentRepository(open)
  const players = new PlayerRepository(open)
  const participants = new ParticipantRepository(open)

  const tournament = await tournaments.createDraft(EDITION)

  return { participants, players, tournamentId: tournament.id ?? 0 }
}

function idOf(player: Player): number {
  return player.id ?? 0
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('ParticipantRepository', () => {
  it('starts with nobody', async () => {
    const { participants, tournamentId } = await build()

    expect(await participants.list(tournamentId)).toHaveLength(0)
  })

  it('adds players from the pool and lists them', async () => {
    const { participants, players, tournamentId } = await build()

    await participants.add(tournamentId, idOf(await players.create('Lucas', 'Martin')))
    await participants.add(tournamentId, idOf(await players.create('Benjamin', 'Ledrappier')))

    expect((await participants.list(tournamentId)).map((p) => p.firstName)).toEqual([
      'Benjamin',
      'Lucas',
    ])
  })

  it('refuses the same player twice in one edition', async () => {
    const { participants, players, tournamentId } = await build()
    const lucas = idOf(await players.create('Lucas', 'Martin'))

    await participants.add(tournamentId, lucas)

    await expect(participants.add(tournamentId, lucas)).rejects.toBeInstanceOf(
      AlreadyParticipatingError,
    )
    expect(await participants.list(tournamentId)).toHaveLength(1)
  })

  it('refuses a player who is not in the pool', async () => {
    const { participants, tournamentId } = await build()

    await expect(participants.add(tournamentId, 4242)).rejects.toBeInstanceOf(UnknownPlayerError)
  })

  it('removes a participant without touching the pool', async () => {
    const { participants, players, tournamentId } = await build()
    const lucas = idOf(await players.create('Lucas', 'Martin'))

    await participants.add(tournamentId, lucas)
    await participants.remove(tournamentId, lucas)

    expect(await participants.list(tournamentId)).toHaveLength(0)
    expect(await players.list()).toHaveLength(1)
  })

  it('lets the same player play two editions', async () => {
    open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
    const tournaments = new TournamentRepository(open)
    const players = new PlayerRepository(open)
    const participants = new ParticipantRepository(open)

    const spring = await tournaments.createDraft(EDITION)
    const autumn = await tournaments.createDraft({ ...EDITION, label: 'Tournoi d’automne' })
    const lucas = idOf(await players.create('Lucas', 'Martin'))

    await participants.add(spring.id ?? 0, lucas)
    await participants.add(autumn.id ?? 0, lucas)

    expect(await participants.list(spring.id ?? 0)).toHaveLength(1)
    expect(await participants.list(autumn.id ?? 0)).toHaveLength(1)
  })

  it('keeps editions apart', async () => {
    open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
    const tournaments = new TournamentRepository(open)
    const players = new PlayerRepository(open)
    const participants = new ParticipantRepository(open)

    const spring = await tournaments.createDraft(EDITION)
    const autumn = await tournaments.createDraft({ ...EDITION, label: 'Tournoi d’automne' })

    await participants.add(spring.id ?? 0, idOf(await players.create('Lucas', 'Martin')))

    expect(await participants.list(autumn.id ?? 0)).toHaveLength(0)
  })
})
