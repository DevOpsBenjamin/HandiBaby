import Dexie, { type Table } from 'dexie'

export interface LocalSyncQueue {
  id?: number
  table: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  recordId: string
  payload: any
  timestamp: number
}

// Entities for HandiBaby (3 teams, 2 players per team, matches)
export interface Player {
  id: string // UUID or random string
  name: string
  createdAt: number
}

export interface Team {
  id: string
  name: string
  player1Id: string
  player2Id: string
  createdAt: number
}

export interface Match {
  id: string
  team1Id: string
  team2Id: string
  score1: number
  score2: number
  playedAt: number
  isSynced?: number // 0 or 1
}

export class HandiBabyDatabase extends Dexie {
  players!: Table<Player, string>
  teams!: Table<Team, string>
  matches!: Table<Match, string>
  syncQueue!: Table<LocalSyncQueue, number>

  constructor() {
    super('HandiBabyDatabase')

    // Schema definition.
    // Indexing fields that we might query or filter on.
    this.version(1).stores({
      players: 'id, name, createdAt',
      teams: 'id, name, player1Id, player2Id, createdAt',
      matches: 'id, team1Id, team2Id, playedAt, isSynced',
      syncQueue: '++id, table, action, recordId, timestamp'
    })
  }
}

export const db = new HandiBabyDatabase()
export default db
