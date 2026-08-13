import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { BlankLabelError, NotInProgressError, TournamentRepository } from '../TournamentRepository'
import { WeakPassphraseError, verifyPassphrase } from '../domain/passphrase'

const PHRASE = 'babyfoot du mardi'

let open: HandiBabyDatabase | null = null

function buildRepository(): TournamentRepository {
  open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
  return new TournamentRepository(open)
}

function draft(overrides: Partial<{ label: string; startDate: string; passphrase: string }> = {}) {
  return {
    label: 'Tournoi de printemps',
    startDate: '2026-08-13',
    passphrase: PHRASE,
    ...overrides,
  }
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('TournamentRepository', () => {
  it('creates an edition as a draft with a public identifier', async () => {
    const repository = buildRepository()

    const created = await repository.createDraft(draft())

    expect(created.id).toBeDefined()
    expect(created.publicId).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.status).toBe('draft')
    expect(created.label).toBe('Tournoi de printemps')
    expect(created.startDate).toBe('2026-08-13')
  })

  it('stores a verifier, never the passphrase', async () => {
    const repository = buildRepository()

    const created = await repository.createDraft(draft())

    expect(JSON.stringify(created)).not.toContain(PHRASE)
    expect(await verifyPassphrase(PHRASE, created.passphraseHash)).toBe(true)
    expect(await verifyPassphrase('autre chose ici', created.passphraseHash)).toBe(false)
  })

  it('writes nothing when the passphrase is too short', async () => {
    const repository = buildRepository()

    await expect(
      repository.createDraft(draft({ passphrase: 'trop court' })),
    ).rejects.toBeInstanceOf(WeakPassphraseError)
    expect(await repository.listInProgress()).toHaveLength(0)
  })

  it('refuses a blank label', async () => {
    const repository = buildRepository()

    await expect(repository.createDraft(draft({ label: '   ' }))).rejects.toBeInstanceOf(
      BlankLabelError,
    )
  })

  it('gives every edition a distinct public identifier', async () => {
    const repository = buildRepository()

    const first = await repository.createDraft(draft())
    const second = await repository.createDraft(draft({ label: 'Tournoi d’automne' }))

    expect(first.publicId).not.toBe(second.publicId)
    expect((await repository.findByPublicId(second.publicId))?.label).toBe('Tournoi d’automne')
  })

  it('sorts editions in progress newest first and leaves finished ones out', async () => {
    const repository = buildRepository()

    const older = await repository.createDraft(draft({ label: 'Ancienne' }))
    const newer = await repository.createDraft(draft({ label: 'Récente' }))

    // Creation timestamps can land on the same millisecond in a test.
    await open?.tournaments.update(older.id ?? 0, { createdAt: newer.createdAt - 1_000 })

    expect((await repository.listInProgress()).map((t) => t.label)).toEqual(['Récente', 'Ancienne'])

    await open?.tournaments.update(older.id ?? 0, { status: 'finished' })

    expect((await repository.listInProgress()).map((t) => t.label)).toEqual(['Récente'])
    expect((await repository.listFinished()).map((t) => t.label)).toEqual(['Ancienne'])
  })

  it('counts a draft and a running playoff as in progress', async () => {
    const repository = buildRepository()
    const created = await repository.createDraft(draft())

    for (const status of ['round-robin', 'playoff'] as const) {
      await open?.tournaments.update(created.id ?? 0, { status })
      expect(await repository.listInProgress()).toHaveLength(1)
    }
  })
})

/** The repository and the database behind it, which these assertions read directly. */
function buildBoth() {
  const repository = buildRepository()

  if (open === null) {
    throw new Error('database was not opened')
  }

  return { repository, db: open }
}

describe('abandoning an edition', () => {
  it('moves it out of the editions in progress without erasing it', async () => {
    const { repository, db } = buildBoth()
    const tournament = await repository.createDraft(draft())
    const tournamentId = tournament.id ?? 0

    await repository.abandon(tournamentId)

    expect((await db.tournaments.get(tournamentId))?.status).toBe('abandoned')
    expect(await repository.listInProgress()).toHaveLength(0)
  })

  it('leaves it reachable among the editions that are over', async () => {
    const { repository } = buildBoth()
    const tournament = await repository.createDraft(draft())

    await repository.abandon(tournament.id ?? 0)

    expect((await repository.listFinished()).map((row) => row.publicId)).toEqual([
      tournament.publicId,
    ])
    expect(await repository.findByPublicId(tournament.publicId)).toBeDefined()
  })

  it('deletes nothing, so the matches already played keep counting', async () => {
    const { repository, db } = buildBoth()
    const tournament = await repository.createDraft(draft())
    const tournamentId = tournament.id ?? 0

    await db.matches.add({
      tournamentId,
      phase: 'round-robin',
      duel: 1,
      rankInDuel: 1,
      blueTeamId: 1,
      whiteTeamId: 2,
      blueDefenderId: 1,
      blueAttackerId: 2,
      whiteDefenderId: 3,
      whiteAttackerId: 4,
      winnerTeamId: 1,
      loserScore: 4,
      enteredAt: 1,
    })

    await repository.abandon(tournamentId)

    expect(await db.matches.where('tournamentId').equals(tournamentId).count()).toBe(1)
  })

  it('refuses to abandon an edition that is already over', async () => {
    const { repository, db } = buildBoth()
    const tournament = await repository.createDraft(draft())
    const tournamentId = tournament.id ?? 0

    await db.tournaments.update(tournamentId, { status: 'finished' })

    await expect(repository.abandon(tournamentId)).rejects.toBeInstanceOf(NotInProgressError)
  })

  it('refuses to abandon the same edition twice', async () => {
    const { repository } = buildBoth()
    const tournament = await repository.createDraft(draft())

    await repository.abandon(tournament.id ?? 0)

    await expect(repository.abandon(tournament.id ?? 0)).rejects.toBeInstanceOf(NotInProgressError)
  })
})
