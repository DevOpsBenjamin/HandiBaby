/**
 * Which editions this device may write to.
 *
 * Deliberately not in the database: an unlock is device state, not tournament
 * data, and it must never be pushed anywhere. Keyed on the edition's public
 * identifier rather than its local row id, which differs from one device to the
 * next.
 */
export class DeviceUnlocks {
  static readonly #PREFIX = 'handibaby.unlock.'

  constructor(private readonly storage: Storage = localStorage) {}

  isUnlocked(publicId: string): boolean {
    return this.storage.getItem(DeviceUnlocks.#key(publicId)) !== null
  }

  unlock(publicId: string): void {
    this.storage.setItem(DeviceUnlocks.#key(publicId), String(Date.now()))
  }

  lock(publicId: string): void {
    this.storage.removeItem(DeviceUnlocks.#key(publicId))
  }

  static #key(publicId: string): string {
    return `${DeviceUnlocks.#PREFIX}${publicId}`
  }
}
