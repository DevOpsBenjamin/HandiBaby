import Dexie, { type Table } from 'dexie'
import type { OutboxEntry, SyncCheckpoint } from './types'

/**
 * The local source of truth. Every view reads from here, online or not.
 *
 * Feature tables are added by bumping the version and declaring the new stores;
 * `outbox` and `checkpoints` belong to the sync engine and stay stable.
 */
export class HandiBabyDatabase extends Dexie {
  outbox!: Table<OutboxEntry, number>
  checkpoints!: Table<SyncCheckpoint, string>

  constructor(name = 'handibaby') {
    super(name)

    this.version(1).stores({
      outbox: '++id, adapter, createdAt',
      checkpoints: 'adapter',
    })
  }

  /** Wipes local state. Used by tests and by a future "reset this device" action. */
  async reset(): Promise<void> {
    await Promise.all(this.tables.map((table) => table.clear()))
  }
}
