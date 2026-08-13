import Dexie, { type Table } from 'dexie'
import type { OutboxEntry, SyncCheckpoint } from './types'
import type { Player } from '@/features/players/domain/types'
import type { JournalEntry } from '@/features/tournaments/domain/journal'
import type { Match, Team, Tournament, TournamentPlayer } from '@/features/tournaments/domain/types'

/**
 * The local source of truth. Every view reads from here, online or not.
 *
 * Feature tables are added by bumping the version and declaring the new stores;
 * `outbox` and `checkpoints` belong to the sync engine and stay stable.
 */
export class HandiBabyDatabase extends Dexie {
  outbox!: Table<OutboxEntry, number>
  checkpoints!: Table<SyncCheckpoint, string>

  players!: Table<Player, number>
  tournaments!: Table<Tournament, number>
  tournamentPlayers!: Table<TournamentPlayer, number>
  teams!: Table<Team, number>
  matches!: Table<Match, number>
  journal!: Table<JournalEntry, number>

  constructor(name = 'handibaby') {
    super(name)

    this.version(1).stores({
      outbox: '++id, adapter, createdAt',
      checkpoints: 'adapter',
    })

    this.version(2).stores({
      // The pool outlives editions. Uniqueness is on the normalised key rather
      // than the display fields, so casing and stray spaces cannot fork a
      // player's history in two.
      players: '++id, firstName, lastName, &nameKey',
      tournaments: '++id, status, createdAt',
      tournamentPlayers: '++id, tournamentId, playerId, &[tournamentId+playerId]',
      teams: '++id, tournamentId',
      matches: '++id, tournamentId, phase, [tournamentId+duel]',
    })

    // An edition is now identified across devices by a generated public id, so
    // it needs its own unique index. Version 2 is already deployed and its
    // declaration is history: a schema change gets a new version, never an edit.
    this.version(3).stores({
      tournaments: '++id, &publicId, status, createdAt',
    })

    // History of what was written to a match. Append-only, so it is its own
    // table rather than columns on the match it describes. The unique index on
    // the client-generated id is what makes replaying a queued write harmless.
    this.version(4).stores({
      journal: '++id, &entryId, matchId, tournamentId',
    })
  }

  /** Wipes local state. Used by tests and by a future "reset this device" action. */
  async reset(): Promise<void> {
    await Promise.all(this.tables.map((table) => table.clear()))
  }
}
