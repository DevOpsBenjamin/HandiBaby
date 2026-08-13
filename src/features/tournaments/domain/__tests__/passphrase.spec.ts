import { describe, expect, it } from 'vitest'
import {
  MINIMUM_PASSPHRASE_LENGTH,
  WeakPassphraseError,
  hashPassphrase,
  isStrongEnough,
  verifyPassphrase,
} from '../passphrase'

// Cost 4 keeps the suite fast; production hashes at 12.
const COST = 4
const PHRASE = 'babyfoot du mardi'

describe('isStrongEnough', () => {
  it('demands twelve characters', () => {
    expect(isStrongEnough('a'.repeat(MINIMUM_PASSPHRASE_LENGTH - 1))).toBe(false)
    expect(isStrongEnough('a'.repeat(MINIMUM_PASSPHRASE_LENGTH))).toBe(true)
  })

  it('measures the phrase without its surrounding spaces', () => {
    expect(isStrongEnough(`  ${'a'.repeat(MINIMUM_PASSPHRASE_LENGTH - 1)}  `)).toBe(false)
  })
})

describe('hashPassphrase', () => {
  it('refuses a phrase the format considers guessable', async () => {
    await expect(hashPassphrase('trop court', COST)).rejects.toBeInstanceOf(WeakPassphraseError)
  })

  it('never returns the passphrase itself', async () => {
    const verifier = await hashPassphrase(PHRASE, COST)

    expect(verifier).not.toContain(PHRASE)
    expect(verifier.startsWith('$2')).toBe(true)
    expect(verifier).toHaveLength(60)
  })

  it('produces a different verifier every time, so two editions never look alike', async () => {
    const first = await hashPassphrase(PHRASE, COST)
    const second = await hashPassphrase(PHRASE, COST)

    expect(first).not.toBe(second)
    expect(await verifyPassphrase(PHRASE, first)).toBe(true)
    expect(await verifyPassphrase(PHRASE, second)).toBe(true)
  })
})

describe('verifyPassphrase', () => {
  it('accepts the phrase it was built from', async () => {
    const verifier = await hashPassphrase(PHRASE, COST)

    expect(await verifyPassphrase(PHRASE, verifier)).toBe(true)
  })

  it('rejects anything else', async () => {
    const verifier = await hashPassphrase(PHRASE, COST)

    expect(await verifyPassphrase('babyfoot du jeudi', verifier)).toBe(false)
    expect(await verifyPassphrase('', verifier)).toBe(false)
  })

  it('tolerates the trailing space a mobile keyboard adds', async () => {
    const verifier = await hashPassphrase(PHRASE, COST)

    expect(await verifyPassphrase(` ${PHRASE} `, verifier)).toBe(true)
  })

  it('stays case sensitive', async () => {
    const verifier = await hashPassphrase(PHRASE, COST)

    expect(await verifyPassphrase(PHRASE.toUpperCase(), verifier)).toBe(false)
  })
})
