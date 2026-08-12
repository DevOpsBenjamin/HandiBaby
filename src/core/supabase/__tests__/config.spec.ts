import { describe, expect, it } from 'vitest'
import { readPollIntervalMs, readSupabaseConfig } from '../config'

describe('readSupabaseConfig', () => {
  it('returns null when either variable is missing or blank', () => {
    expect(readSupabaseConfig({})).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_ANON_KEY: 'key' }),
    ).toBeNull()
  })

  it('trims both values when they are present', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: ' https://x.supabase.co ',
        VITE_SUPABASE_ANON_KEY: ' key ',
      }),
    ).toEqual({ url: 'https://x.supabase.co', anonKey: 'key' })
  })
})

describe('readPollIntervalMs', () => {
  it('falls back to 5s on missing or nonsensical values', () => {
    expect(readPollIntervalMs({})).toBe(5_000)
    expect(readPollIntervalMs({ VITE_SYNC_POLL_INTERVAL_MS: 'soon' })).toBe(5_000)
    expect(readPollIntervalMs({ VITE_SYNC_POLL_INTERVAL_MS: '-1' })).toBe(5_000)
  })

  it('honours a positive override', () => {
    expect(readPollIntervalMs({ VITE_SYNC_POLL_INTERVAL_MS: '15000' })).toBe(15_000)
  })
})
