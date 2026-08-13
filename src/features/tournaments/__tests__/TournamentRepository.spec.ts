import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { BlankLabelError, TournamentRepository } from '../TournamentRepository'
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
