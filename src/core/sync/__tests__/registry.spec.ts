import { describe, expect, it, vi } from 'vitest'
import { SyncRegistry } from '../registry'
import type { SyncAdapter } from '../types'

function adapter(name: string): SyncAdapter {
  return { name, pull: vi.fn<SyncAdapter['pull']>(), push: vi.fn<SyncAdapter['push']>() }
}

describe('SyncRegistry', () => {
  it('exposes adapters in registration order', () => {
    const registry = new SyncRegistry()
    registry.register(adapter('teams'))
    registry.register(adapter('matches'))

    expect(registry.list().map((entry) => entry.name)).toEqual(['teams', 'matches'])
    expect(registry.get('teams')?.name).toBe('teams')
    expect(registry.get('missing')).toBeUndefined()
  })

  it('refuses a duplicate name rather than silently replacing an adapter', () => {
    const registry = new SyncRegistry()
    registry.register(adapter('matches'))

    expect(() => registry.register(adapter('matches'))).toThrow(/already registered/)
  })
})
