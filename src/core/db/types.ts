/**
 * A local write waiting to be replayed against Supabase.
 * Features push their own payload shape; the engine only routes it to an adapter.
 */
export interface OutboxEntry<TPayload = unknown> {
  id?: number
  /** Name of the SyncAdapter that knows how to replay this entry. */
  adapter: string
  /** Feature-defined operation discriminant, e.g. 'record-score'. */
  operation: string
  payload: TPayload
  createdAt: number
  attempts: number
  lastError: string | null
}

/** Per-adapter bookkeeping so a pull can ask the server only for what changed. */
export interface SyncCheckpoint {
  /** Adapter name. */
  adapter: string
  /** ISO timestamp of the newest remote row seen, or null before the first pull. */
  cursor: string | null
  lastPulledAt: number | null
}
