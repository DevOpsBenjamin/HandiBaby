import { compare, hash } from 'bcryptjs'

/**
 * Twelve characters is a requirement, not a suggestion. Supabase Auth was
 * turned down, so no rate limiting stands between a guess and the next one, and
 * the verifier travels with the tournament so it can be checked offline. Its
 * slowness is the only rampart left, which is why this is bcrypt and not a fast
 * digest.
 */
export const MINIMUM_PASSPHRASE_LENGTH = 12

const DEFAULT_COST = 12

export class WeakPassphraseError extends Error {
  constructor() {
    super(`La phrase de passe doit faire au moins ${MINIMUM_PASSPHRASE_LENGTH} caractères`)
    this.name = 'WeakPassphraseError'
  }
}

/**
 * Mobile keyboards append a space after an autocompletion. Left in, that space
 * would silently become part of the secret and lock everyone out of an edition
 * nobody could reproduce.
 */
export function normalisePassphrase(passphrase: string): string {
  return passphrase.trim()
}

export function isStrongEnough(passphrase: string): boolean {
  return normalisePassphrase(passphrase).length >= MINIMUM_PASSPHRASE_LENGTH
}

export async function hashPassphrase(passphrase: string, cost = DEFAULT_COST): Promise<string> {
  if (!isStrongEnough(passphrase)) {
    throw new WeakPassphraseError()
  }

  return hash(normalisePassphrase(passphrase), cost)
}

export async function verifyPassphrase(passphrase: string, verifier: string): Promise<boolean> {
  return compare(normalisePassphrase(passphrase), verifier)
}
