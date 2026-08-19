import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseConfig } from './config'
import type { Database } from './database'

/**
 * Owns the single Supabase client and the "is it configured at all" question.
 * The client is created lazily so an unconfigured build never touches the network.
 */
export class SupabaseGateway {
  readonly #config: SupabaseConfig | null
  #client: SupabaseClient<Database, 'app_handibaby'> | null = null

  constructor(config: SupabaseConfig | null) {
    this.#config = config
  }

  get isConfigured(): boolean {
    return this.#config !== null
  }

  /** Returns null when Supabase is not configured; callers stay offline-only. */
  tryGetClient(): SupabaseClient<Database, 'app_handibaby'> | null {
    if (this.#config === null) {
      return null
    }

    this.#client ??= createClient<Database, 'app_handibaby'>(
      this.#config.url,
      this.#config.anonKey,
      {
        db: { schema: 'app_handibaby' },
        auth: {
          // Writes go through SECURITY DEFINER RPCs guarded by a passphrase,
          // so there is no session to persist or refresh.
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    return this.#client
  }

  /** Same as tryGetClient, for code paths that already checked isConfigured. */
  requireClient(): SupabaseClient<Database, 'app_handibaby'> {
    const client = this.tryGetClient()
    if (client === null) {
      throw new Error(
        'Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
      )
    }
    return client
  }
}
