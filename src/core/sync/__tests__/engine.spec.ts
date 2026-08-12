import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HandiBabyDatabase } from '../../db/database'
import { ConnectivityMonitor } from '../../network/connectivity'
import { SupabaseGateway } from '../../supabase/gateway'
import { SyncEngine } from '../engine'
import { SyncRegistry } from '../registry'
import type { SyncAdapter } from '../types'

const CONFIG = { url: 'http://localhost:54321', anonKey: 'anon-key' }

function buildEngine(gateway: SupabaseGateway) {
  const db = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
  const registry = new SyncRegistry()
  const connectivity = new ConnectivityMonitor()

  const engine = new SyncEngine({ db, gateway, registry, connectivity, pollIntervalMs: 60_000 })

  return { db, registry, engine }
}

describe('SyncEngine', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    await cleanup?.()
    cleanup = null
  })

  it('stays disabled when Supabase is not configured', async () => {
    const { db, engine } = buildEngine(new SupabaseGateway(null))
    cleanup = () => db.delete()

    const snapshot = await engine.sync()

    expect(snapshot.phase).toBe('disabled')
  })

  it('pushes queued writes, then pulls and stores the cursor', async () => {
    const { db, registry, engine } = buildEngine(new SupabaseGateway(CONFIG))
    cleanup = () => db.delete()

    const push = vi.fn<SyncAdapter<{ score: number }>['push']>().mockResolvedValue(undefined)
    const adapter: SyncAdapter<{ score: number }> = {
      name: 'matches',
      push,
      pull: vi.fn<SyncAdapter['pull']>().mockResolvedValue('2026-08-12T10:00:00Z'),
    }
    registry.register(adapter as SyncAdapter)

    await engine.enqueue({ adapter: 'matches', operation: 'record-score', payload: { score: 7 } })
    const snapshot = await engine.sync()

    expect(push).toHaveBeenCalledOnce()
    expect(snapshot.phase).toBe('idle')
    expect(snapshot.pendingOperations).toBe(0)
    expect(await db.outbox.count()).toBe(0)
    expect((await db.checkpoints.get('matches'))?.cursor).toBe('2026-08-12T10:00:00Z')
  })

  it('keeps a failed write in the outbox and reports the error', async () => {
    const { db, registry, engine } = buildEngine(new SupabaseGateway(CONFIG))
    cleanup = () => db.delete()

    const pull = vi.fn<SyncAdapter['pull']>()
    registry.register({
      name: 'matches',
      pull,
      push: vi.fn<SyncAdapter['push']>().mockRejectedValue(new Error('passphrase refused')),
    } as SyncAdapter)

    await engine.enqueue({ adapter: 'matches', operation: 'record-score', payload: {} })
    const snapshot = await engine.sync()

    expect(snapshot.phase).toBe('error')
    expect(snapshot.lastError).toBe('passphrase refused')
    expect(snapshot.pendingOperations).toBe(1)
    // A failed push must not let the pull overwrite local state.
    expect(pull).not.toHaveBeenCalled()

    const [entry] = await db.outbox.toArray()
    expect(entry?.attempts).toBe(1)
    expect(entry?.lastError).toBe('passphrase refused')
  })

  it('fails loudly when a queued write targets an unknown adapter', async () => {
    const { db, engine } = buildEngine(new SupabaseGateway(CONFIG))
    cleanup = () => db.delete()

    await engine.enqueue({ adapter: 'ghost', operation: 'noop', payload: {} })
    const snapshot = await engine.sync()

    expect(snapshot.phase).toBe('error')
    expect(snapshot.lastError).toContain('ghost')
    expect(snapshot.pendingOperations).toBe(1)
  })
})

describe('SyncEngine offline', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')

  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
  })

  afterEach(() => {
    if (descriptor) {
      Object.defineProperty(Navigator.prototype, 'onLine', descriptor)
    }
  })

  it('does not touch the network while the browser reports offline', async () => {
    const { db, registry, engine } = buildEngine(new SupabaseGateway(CONFIG))

    const pull = vi.fn<SyncAdapter['pull']>()
    registry.register({ name: 'matches', pull, push: vi.fn<SyncAdapter['push']>() } as SyncAdapter)

    const snapshot = await engine.sync()

    expect(snapshot.phase).toBe('offline')
    expect(pull).not.toHaveBeenCalled()

    await db.delete()
  })
})
