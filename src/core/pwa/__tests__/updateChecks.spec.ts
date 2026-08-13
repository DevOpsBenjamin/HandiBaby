import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleUpdateChecks, UPDATE_CHECK_INTERVAL_MS } from '../updateChecks'

function registration() {
  const update = vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined)
  return { update, registration: { update } }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('scheduleUpdateChecks', () => {
  it('asks again on every interval, so an open tab learns about a deployment', () => {
    vi.useFakeTimers()
    const { update, registration: sw } = registration()

    scheduleUpdateChecks(sw, { intervalMs: 1_000 })

    expect(update).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3_000)

    expect(update).toHaveBeenCalledTimes(3)
  })

  it('skips the check while the browser reports no connectivity', () => {
    vi.useFakeTimers()
    const { update, registration: sw } = registration()
    let online = false

    scheduleUpdateChecks(sw, { intervalMs: 1_000, isOnline: () => online })

    vi.advanceTimersByTime(3_000)
    expect(update).not.toHaveBeenCalled()

    // Read at each tick, so coming back online needs no re-registering.
    online = true
    vi.advanceTimersByTime(1_000)
    expect(update).toHaveBeenCalledOnce()
  })

  it('stops asking once the handle is called', () => {
    vi.useFakeTimers()
    const { update, registration: sw } = registration()

    const stop = scheduleUpdateChecks(sw, { intervalMs: 1_000 })
    vi.advanceTimersByTime(1_000)
    stop()
    vi.advanceTimersByTime(5_000)

    expect(update).toHaveBeenCalledOnce()
  })

  it('keeps checking after a failed check rather than giving up', async () => {
    vi.useFakeTimers()
    const update = vi.fn<() => Promise<unknown>>().mockRejectedValue(new Error('offline-ish'))

    scheduleUpdateChecks({ update }, { intervalMs: 1_000 })

    await vi.advanceTimersByTimeAsync(2_000)

    expect(update).toHaveBeenCalledTimes(2)
  })

  it('defaults to an interval far below the lifetime of a tab left open', () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(60 * 60 * 1000)
  })
})
