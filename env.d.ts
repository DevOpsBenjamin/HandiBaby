/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />

interface ImportMetaEnv {
  /** Supabase project URL. Absent means the app runs on IndexedDB only. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon key. Public by design: writes are guarded server-side. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Milliseconds between automatic pulls while the page is visible. Default 5000. */
  readonly VITE_SYNC_POLL_INTERVAL_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
