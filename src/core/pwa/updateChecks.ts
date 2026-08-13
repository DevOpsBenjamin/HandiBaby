/**
 * How often an open tab asks whether a new build shipped.
 *
 * The link lives in a Teams channel and gets left open for weeks, so a reload
 * is not something to count on. An hour is far below the useful lifetime of a
 * tab and far above anything that would look like polling.
 */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export interface UpdateCheckOptions {
  intervalMs?: number
  /**
   * Read at each tick rather than once, so a tab that went offline and came
   * back does not need re-registering. Deliberately `navigator.onLine` and not
   * the sync engine's monitor, which only tracks events once Supabase is
   * configured and would sit on a stale value otherwise.
   */
  isOnline?: () => boolean
  setInterval?: typeof globalThis.setInterval
  clearInterval?: typeof globalThis.clearInterval
}

/** Something that can be asked to look for a new service worker. */
export interface UpdatableRegistration {
  update: () => Promise<unknown>
}

/**
 * Asks the registration to look again on a timer, and returns the stop handle.
 *
 * Offline ticks are skipped: the fetch would fail for a reason that has nothing
 * to do with whether a new version exists, so it is noise rather than
 * information.
 */
export function scheduleUpdateChecks(
  registration: UpdatableRegistration,
  options: UpdateCheckOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? UPDATE_CHECK_INTERVAL_MS
  const isOnline = options.isOnline ?? (() => navigator.onLine)
  const start = options.setInterval ?? globalThis.setInterval
  const stop = options.clearInterval ?? globalThis.clearInterval

  const timer = start(() => {
    if (!isOnline()) {
      return
    }

    // A rejected check is not worth surfacing: the next tick will try again.
    void registration.update().catch(() => undefined)
  }, intervalMs)

  return () => stop(timer)
}
