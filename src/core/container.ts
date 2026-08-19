import { HandiBabyDatabase } from './db/database'
import { ConnectivityMonitor } from './network/connectivity'
import { readPollIntervalMs, readSupabaseConfig } from './supabase/config'
import { SupabaseGateway } from './supabase/gateway'
import { SyncEngine } from './sync/engine'
import { SyncRegistry } from './sync/registry'

import { ScoreSyncAdapter } from '@/features/tournaments/sync/ScoreSyncAdapter'
import { TournamentSyncAdapter } from '@/features/tournaments/sync/TournamentSyncAdapter'

/**
 * Composition root. Everything below is instantiated once and imported by the
 * Pinia stores, never by components directly.
 */
export const db = new HandiBabyDatabase()

export const gateway = new SupabaseGateway(readSupabaseConfig(import.meta.env))

export const registry = new SyncRegistry()
registry.register(new TournamentSyncAdapter())
registry.register(new ScoreSyncAdapter())

export const connectivity = new ConnectivityMonitor()

export const syncEngine = new SyncEngine({
  db,
  gateway,
  registry,
  connectivity,
  pollIntervalMs: readPollIntervalMs(import.meta.env),
})
