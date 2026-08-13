import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { BlankPlayerNameError, DuplicatePlayerError, PlayerRepository } from '../PlayerRepository'

let open: HandiBabyDatabase | null = null

function buildRepository(): PlayerRepository {
  open = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
  return new PlayerRepository(open)
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('PlayerRepository', () => {
  it('creates a player and gives it an identity key', async () => {
    const repository = buildRepository()

    const created = await repository.create('Lucas', 'Martin')

    expect(created.id).toBeDefined()
    expect(created.nameKey).toBe('lucas martin')
    expect(await repository.list()).toHaveLength(1)
  })

  it('keeps two players who only share a first name', async () => {
    const repository = buildRepository()

    await repository.create('Lucas', 'Martin')
    await repository.create('Lucas', 'Dubois')

    expect(await repository.list()).toHaveLength(2)
  })

  it('refuses the same person retyped with different casing or spacing', async () => {
    const repository = buildRepository()
    await repository.create('Lucas', 'Martin')

    await expect(repository.create('  lucas ', 'MARTIN')).rejects.toBeInstanceOf(
      DuplicatePlayerError,
    )
    expect(await repository.list()).toHaveLength(1)
  })

  it('names the player already holding the key when it refuses', async () => {
    const repository = buildRepository()
    await repository.create('Lucas', 'Martin')

    await expect(repository.create('lucas', 'martin')).rejects.toThrow(/Lucas Martin/)
  })

  it('refuses a blank first or last name', async () => {
    const repository = buildRepository()

    await expect(repository.create('   ', 'Martin')).rejects.toBeInstanceOf(BlankPlayerNameError)
    await expect(repository.create('Lucas', '')).rejects.toBeInstanceOf(BlankPlayerNameError)
    expect(await repository.list()).toHaveLength(0)
  })

  it('stores names as typed, trimmed, rather than normalised', async () => {
    const repository = buildRepository()

    const created = await repository.create('  Lucas  ', ' Martin ')

    expect(created.firstName).toBe('Lucas')
    expect(created.lastName).toBe('Martin')
  })
})
