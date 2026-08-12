import type { SyncAdapter } from './types'

/** Feature modules register their adapter here at startup. */
export class SyncRegistry {
  readonly #adapters = new Map<string, SyncAdapter>()

  register(adapter: SyncAdapter): void {
    if (this.#adapters.has(adapter.name)) {
      throw new Error(`Sync adapter "${adapter.name}" is already registered`)
    }
    this.#adapters.set(adapter.name, adapter as SyncAdapter)
  }

  get(name: string): SyncAdapter | undefined {
    return this.#adapters.get(name)
  }

  list(): readonly SyncAdapter[] {
    return [...this.#adapters.values()]
  }
}
