export type ConnectivityListener = (online: boolean) => void

/**
 * Thin wrapper over navigator.onLine. It reports what the browser believes,
 * which is enough to decide "try to sync now"; the sync itself is the real probe.
 */
export class ConnectivityMonitor {
  readonly #listeners = new Set<ConnectivityListener>()
  #online: boolean
  #started = false

  constructor(private readonly target: Window = window) {
    this.#online = target.navigator.onLine
  }

  get isOnline(): boolean {
    return this.#online
  }

  start(): void {
    if (this.#started) {
      return
    }
    this.target.addEventListener('online', this.#handleOnline)
    this.target.addEventListener('offline', this.#handleOffline)
    this.#started = true
  }

  stop(): void {
    if (!this.#started) {
      return
    }
    this.target.removeEventListener('online', this.#handleOnline)
    this.target.removeEventListener('offline', this.#handleOffline)
    this.#started = false
  }

  subscribe(listener: ConnectivityListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  readonly #handleOnline = (): void => this.#emit(true)
  readonly #handleOffline = (): void => this.#emit(false)

  #emit(online: boolean): void {
    this.#online = online
    for (const listener of this.#listeners) {
      listener(online)
    }
  }
}
