import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import type { Database } from '@/core/supabase/database'
import type { SyncContext } from '@/core/sync/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TOURNAMENT_ADAPTER, TournamentSyncAdapter } from '../TournamentSyncAdapter'

describe('TournamentSyncAdapter', () => {
  let db: HandiBabyDatabase
  let adapter: TournamentSyncAdapter

  beforeEach(() => {
    db = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
    adapter = new TournamentSyncAdapter()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('has the expected adapter name', () => {
    expect(adapter.name).toBe(TOURNAMENT_ADAPTER)
  })

  it('uploads local tournament to server via sync_tournament_bundle RPC', async () => {
    const tournamentId = await db.tournaments.add({
      publicId: 'tourn-123',
      label: 'Local Edition',
      startDate: '2026-08-19',
      status: 'draft',
      passphraseHash: 'hash-abc',
      createdAt: 1000,
    })

    const playerId = await db.players.add({
      firstName: 'Alice',
      lastName: 'Dupont',
      nameKey: 'dupont-alice',
    })

    await db.tournamentPlayers.add({
      tournamentId,
      playerId,
    })

    const rpcMock = vi.fn<() => Promise<{ data: null; error: null }>>().mockResolvedValue({
      data: null,
      error: null,
    })
    const selectMock = vi.fn<() => Promise<{ data: []; error: null }>>().mockResolvedValue({
      data: [],
      error: null,
    })
    const fromMock = vi.fn<() => { select: () => { order: typeof selectMock } }>().mockReturnValue({
      select: () => ({ order: selectMock }),
    })

    const client = {
      rpc: rpcMock,
      from: fromMock,
    } as unknown as SupabaseClient<Database, 'app_handibaby'>

    const context: SyncContext = {
      client,
      db,
      cursor: null,
    }

    await adapter.pull(context)

    expect(rpcMock).toHaveBeenCalledWith('sync_tournament_bundle', expect.objectContaining({
      p_tournament: expect.objectContaining({
        public_id: 'tourn-123',
        label: 'Local Edition',
      }),
    }))
  })

  it('downloads remote tournament into local indexedDB', async () => {
    const remoteTournaments = [
      {
        public_id: 'tourn-remote',
        label: 'Remote Edition',
        start_date: '2026-08-19',
        status: 'draft',
        passphrase_hash: 'remote-hash',
        created_at: 5000,
      },
    ]

    const remotePlayers = [
      {
        id: 1,
        first_name: 'Bob',
        last_name: 'Martin',
        name_key: 'martin-bob',
        created_at: '2026-08-19',
      },
    ]

    const rpcMock = vi.fn<() => Promise<{ data: null; error: null }>>().mockResolvedValue({
      data: null,
      error: null,
    })

    const fromMock = vi.fn<
      (table: string) => {
        select: () => { order?: () => Promise<{ data: unknown[]; error: null }> } | Promise<{ data: unknown[]; error: null }>
      }
    >((table: string) => {
      if (table === 'tournaments') {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: remoteTournaments, error: null }),
          }),
        }
      }
      if (table === 'players') {
        return {
          select: () => Promise.resolve({ data: remotePlayers, error: null }),
        }
      }
      return {
        select: () => Promise.resolve({ data: [], error: null }),
      }
    })

    const client = {
      rpc: rpcMock,
      from: fromMock,
    } as unknown as SupabaseClient<Database, 'app_handibaby'>

    const context: SyncContext = {
      client,
      db,
      cursor: null,
    }

    await adapter.pull(context)

    const tournaments = await db.tournaments.toArray()
    expect(tournaments).toHaveLength(1)
    expect(tournaments[0]?.publicId).toBe('tourn-remote')
    expect(tournaments[0]?.label).toBe('Remote Edition')

    const players = await db.players.toArray()
    expect(players).toHaveLength(1)
    expect(players[0]?.nameKey).toBe('martin-bob')
  })

  it('downloads remote match with sides_swapped and inverts local match sides', async () => {
    const tournamentId = await db.tournaments.add({
      publicId: 'tourn-swapped',
      label: 'Swapped Edition',
      startDate: '2026-08-19',
      status: 'round-robin',
      passphraseHash: 'hash',
      createdAt: 1000,
    })

    const matchId = await db.matches.add({
      tournamentId,
      phase: 'round-robin',
      duel: 2,
      rankInDuel: 2,
      blueTeamId: 10,
      whiteTeamId: 20,
      blueDefenderId: 1,
      blueAttackerId: 2,
      whiteDefenderId: 3,
      whiteAttackerId: 4,
      winnerTeamId: null,
      loserScore: null,
      enteredAt: null,
      sidesSwapped: false,
    })

    const remoteTournaments = [
      {
        public_id: 'tourn-swapped',
        label: 'Swapped Edition',
        start_date: '2026-08-19',
        status: 'round-robin',
        passphrase_hash: 'hash',
        created_at: 1000,
      },
    ]

    const remoteMatches = [
      {
        id: 8,
        tournament_public_id: 'tourn-swapped',
        phase: 'round-robin',
        duel: 2,
        rank_in_duel: 2,
        sides_swapped: true,
        winning_side: 'blue',
        loser_score: 4,
        entered_at: 123456,
      },
    ]

    const fromMock = vi.fn<
      (table: string) => {
        select: () => { order?: () => Promise<{ data: unknown[]; error: null }> } | Promise<{ data: unknown[]; error: null }>
      }
    >((table: string) => {
      if (table === 'tournaments') {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: remoteTournaments, error: null }),
          }),
        }
      }
      if (table === 'matches') {
        return {
          select: () => Promise.resolve({ data: remoteMatches, error: null }),
        }
      }
      return {
        select: () => Promise.resolve({ data: [], error: null }),
      }
    })

    const client = {
      rpc: vi.fn<() => Promise<{ data: null; error: null }>>().mockResolvedValue({ data: null, error: null }),
      from: fromMock,
    } as unknown as SupabaseClient<Database, 'app_handibaby'>

    const context: SyncContext = {
      client,
      db,
      cursor: null,
    }

    await adapter.pull(context)

    const updatedMatch = await db.matches.get(matchId)
    expect(updatedMatch?.sidesSwapped).toBe(true)
    expect(updatedMatch?.blueTeamId).toBe(20)
    expect(updatedMatch?.whiteTeamId).toBe(10)
    expect(updatedMatch?.blueDefenderId).toBe(3)
    expect(updatedMatch?.blueAttackerId).toBe(4)
    expect(updatedMatch?.whiteDefenderId).toBe(1)
    expect(updatedMatch?.whiteAttackerId).toBe(2)
    expect(updatedMatch?.winnerTeamId).toBe(20)
    expect(updatedMatch?.loserScore).toBe(4)
  })
})
