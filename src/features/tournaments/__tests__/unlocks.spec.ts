import { beforeEach, describe, expect, it } from 'vitest'
import { DeviceUnlocks } from '../unlocks'

const EDITION = 'edition-a'
const OTHER = 'edition-b'

describe('DeviceUnlocks', () => {
  let unlocks: DeviceUnlocks

  beforeEach(() => {
    localStorage.clear()
    unlocks = new DeviceUnlocks(localStorage)
  })

  it('starts locked', () => {
    expect(unlocks.isUnlocked(EDITION)).toBe(false)
  })

  it('remembers an unlock', () => {
    unlocks.unlock(EDITION)

    expect(unlocks.isUnlocked(EDITION)).toBe(true)
  })

  it('survives a reload, which is the whole point', () => {
    unlocks.unlock(EDITION)

    expect(new DeviceUnlocks(localStorage).isUnlocked(EDITION)).toBe(true)
  })

  it('unlocks one edition without unlocking the others', () => {
    unlocks.unlock(EDITION)

    expect(unlocks.isUnlocked(OTHER)).toBe(false)
  })

  it('locks again on demand', () => {
    unlocks.unlock(EDITION)
    unlocks.lock(EDITION)

    expect(unlocks.isUnlocked(EDITION)).toBe(false)
  })

  it('leaves anything else in storage alone', () => {
    localStorage.setItem('unrelated', 'kept')
    unlocks.unlock(EDITION)
    unlocks.lock(EDITION)

    expect(localStorage.getItem('unrelated')).toBe('kept')
  })
})
