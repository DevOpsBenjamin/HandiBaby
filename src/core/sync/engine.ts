import type { HandiBabyDatabase } from '../db/database'
import type { OutboxEntry } from '../db/types'
import type { SupabaseGateway } from '../supabase/gateway'
import type { ConnectivityMonitor } from '../network/connectivity'
import type { SyncRegistry } from './registry'
import type { SyncContext, SyncPhase, SyncSnapshot } from './types'

export interface SyncEngineOptions {
  db: HandiBabyDatabase
  gateway: SupabaseGateway
  registry: SyncRegistry
  connectivity: ConnectivityMonitor
  /** Delay between automatic pulls while the page is visible. */
  pollIntervalMs: number
}

export type SyncListener = (snapshot: SyncSnapshot) => void

/**
 * Drains the outbox, then pulls each adapter. Runs on reconnection, on a timer
 * while the page is visible, and on demand.
 *
 * A failing push keeps its entry in the outbox and aborts the rest of the drain:
 * order matters, and dropping a score silently would be worse than staying behind.
 */
export class SyncEngine {
  readonly #options: SyncEngineOptions
  readonly #listeners = new Set<SyncListener>()

  #phase: SyncPhase = 'disabled'
  #lastSuccessAt: number | null = null
  #lastError: string | null = null
  #pendingOperations = 0

  #inFlight: Promise<SyncSnapshot> | null = null
  #timer: ReturnType<typeof setInterval> | null = null
  #unsubscribeConnectivity: (() => void) | null = null
  #started = false

  constructor(options: SyncEngineOptions) {
    this.#options = options
    this.#phase = this.#restingPhase()
  }

  get snapshot(): SyncSnapshot {
    return {
      phase: this.#phase,
      lastSuccessAt: this.#lastSuccessAt,
      lastError: this.#lastError,
      pendingOperations: this.#pendingOperations,
    }
  }

  subscribe(listener: SyncListener): () => void {
    this.#listeners.add(listener)
    listener(this.snapshot)
    return () => this.#listeners.delete(listener)
  }

  start(): void {
    if (this.#started) {
      return
    }
    this.#started = true

    void this.#refreshPendingCount()

    if (!this.#options.gateway.isConfigured) {
      return
    }

    this.#options.connectivity.start()
    this.#unsubscribeConnectivity = this.#options.connectivity.subscribe((online) => {
      if (online) {
        void this.sync()
      } else {
        this.#setPhase('offline')
      }
    })

    document.addEventListener('visibilitychange', this.#handleVisibilityChange)
    this.#startTimer()
    void this.sync()
  }

  stop(): void {
    if (!this.#started) {
      return
    }
    this.#started = false

    this.#stopTimer()
    document.removeEventListener('visibilitychange', this.#handleVisibilityChange)
    this.#unsubscribeConnectivity?.()
    this.#unsubscribeConnectivity = null
    this.#options.connectivity.stop()
  }

  /** Queues a local write for replay. Call this right after writing to IndexedDB. */
  async enqueue<TPayload>(
    entry: Pick<OutboxEntry<TPayload>, 'adapter' | 'operation' | 'payload'>,
  ): Promise<void> {
    await this.#options.db.outbox.add({
      ...entry,
      createdAt: Date.now(),
      attempts: 0,
      lastError: null,
    })

    await this.#refreshPendingCount()

    if (this.#canSync()) {
      void this.sync()
    }
  }

  /** Runs a full cycle. Concurrent calls share the run already in flight. */
  sync(): Promise<SyncSnapshot> {
    this.#inFlight ??= this.#run().finally(() => {
      this.#inFlight = null
    })
    return this.#inFlight
  }

  async #run(): Promise<SyncSnapshot> {
    if (!this.#options.gateway.isConfigured) {
      this.#setPhase('disabled')
      return this.snapshot
    }

    if (!this.#options.connectivity.isOnline) {
      this.#setPhase('offline')
      return this.snapshot
    }

    this.#setPhase('syncing')

    try {
      await this.#drainOutbox()
      await this.#pullAll()

      this.#lastError = null
      this.#lastSuccessAt = Date.now()
      this.#setPhase('idle')
    } catch (error) {
      this.#lastError = error instanceof Error ? error.message : String(error)
      this.#setPhase('error')
    }

    await this.#refreshPendingCount()
    return this.snapshot
  }

  async #drainOutbox(): Promise<void> {
    const client = this.#options.gateway.requireClient()
    const entries = await this.#options.db.outbox.orderBy('createdAt').toArray()

    for (const entry of entries) {
      const adapter = this.#options.registry.get(entry.adapter)

      if (adapter === undefined) {
        throw new Error(`No sync adapter registered for "${entry.adapter}"`)
      }

      try {
        await adapter.push(entry, {
          client,
          db: this.#options.db,
          cursor: await this.#readCursor(adapter.name),
        })
      } catch (error) {
        await this.#recordPushFailure(entry, error)
        throw error
      }

      if (entry.id !== undefined) {
        await this.#options.db.outbox.delete(entry.id)
      }
    }
  }

  async #pullAll(): Promise<void> {
    const client = this.#options.gateway.requireClient()

    for (const adapter of this.#options.registry.list()) {
      const context: SyncContext = {
        client,
        db: this.#options.db,
        cursor: await this.#readCursor(adapter.name),
      }

      const cursor = await adapter.pull(context)

      await this.#options.db.checkpoints.put({
        adapter: adapter.name,
        cursor,
        lastPulledAt: Date.now(),
      })
    }
  }

  async #readCursor(adapter: string): Promise<string | null> {
    const checkpoint = await this.#options.db.checkpoints.get(adapter)
    return checkpoint?.cursor ?? null
  }

  async #recordPushFailure(entry: OutboxEntry, error: unknown): Promise<void> {
    if (entry.id === undefined) {
      return
    }

    await this.#options.db.outbox.update(entry.id, {
      attempts: entry.attempts + 1,
      lastError: error instanceof Error ? error.message : String(error),
    })
  }

  async #refreshPendingCount(): Promise<void> {
    this.#pendingOperations = await this.#options.db.outbox.count()
    this.#emit()
  }

  #canSync(): boolean {
    return this.#options.gateway.isConfigured && this.#options.connectivity.isOnline
  }

  #restingPhase(): SyncPhase {
    if (!this.#options.gateway.isConfigured) {
      return 'disabled'
    }
    return this.#options.connectivity.isOnline ? 'idle' : 'offline'
  }

  #startTimer(): void {
    this.#stopTimer()
    this.#timer = setInterval(() => {
      if (this.#canSync()) {
        void this.sync()
      }
    }, this.#options.pollIntervalMs)
  }

  #stopTimer(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer)
      this.#timer = null
    }
  }

  /** Teams and mobile browsers suspend background tabs; stop burning cycles there. */
  readonly #handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.#startTimer()
      if (this.#canSync()) {
        void this.sync()
      }
    } else {
      this.#stopTimer()
    }
  }

  #setPhase(phase: SyncPhase): void {
    this.#phase = phase
    this.#emit()
  }

  #emit(): void {
    const snapshot = this.snapshot
    for (const listener of this.#listeners) {
      listener(snapshot)
    }
  }
}
