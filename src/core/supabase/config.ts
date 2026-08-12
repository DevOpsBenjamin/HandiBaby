/**
 * Supabase is optional: the app is fully usable offline, backed by IndexedDB only.
 * When both variables are present the sync engine turns itself on.
 */
export interface SupabaseConfig {
  readonly url: string
  readonly anonKey: string
}

type EnvRecord = Record<string, unknown>

function readString(env: EnvRecord, key: string): string {
  const value = env[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function readSupabaseConfig(env: EnvRecord): SupabaseConfig | null {
  const url = readString(env, 'VITE_SUPABASE_URL')
  const anonKey = readString(env, 'VITE_SUPABASE_ANON_KEY')

  if (!url || !anonKey) {
    return null
  }

  return { url, anonKey }
}

const DEFAULT_POLL_INTERVAL_MS = 5_000

export function readPollIntervalMs(env: EnvRecord): number {
  const parsed = Number.parseInt(readString(env, 'VITE_SYNC_POLL_INTERVAL_MS'), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POLL_INTERVAL_MS
}
