import type { SupabaseClient } from '@supabase/supabase-js'
import type { HandiBabyDatabase } from '../db/database'
import type { OutboxEntry } from '../db/types'
import type { Database } from '../supabase/database'

export type SyncPhase =
  /** No Supabase configured: the app runs on IndexedDB alone. */
  | 'disabled'
  /** Configured, but the browser reports no connectivity. */
  | 'offline'
  /** Configured and online, nothing in flight. */
  | 'idle'
  | 'syncing'
  /** Last run failed; pending writes are still held in the outbox. */
  | 'error'

export interface SyncSnapshot {
  readonly phase: SyncPhase
  readonly lastSuccessAt: number | null
  readonly lastError: string | null
  readonly pendingOperations: number
}

export interface SyncContext {
  readonly client: SupabaseClient<Database, 'app_handibaby'>
  readonly db: HandiBabyDatabase
  /** Cursor returned by this adapter's previous pull, or null on a cold start. */
  readonly cursor: string | null
}

/**
 * One adapter per feature. The engine handles scheduling, connectivity and the
 * outbox; the adapter only knows its own tables and RPCs.
 */
export interface SyncAdapter<TPayload = unknown> {
  readonly name: string

  /**
   * Fetch remote changes and write them into IndexedDB.
   * Returns the new cursor to persist, or null to keep pulling everything.
   */
  pull(context: SyncContext): Promise<string | null>

  /**
   * Replay one local write against Supabase, normally through a SECURITY DEFINER
   * RPC. Throwing keeps the entry in the outbox and stops the drain.
   */
  push(entry: OutboxEntry<TPayload>, context: SyncContext): Promise<void>
}
