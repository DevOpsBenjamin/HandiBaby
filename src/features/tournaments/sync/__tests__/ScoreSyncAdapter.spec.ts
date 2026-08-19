import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import type { OutboxEntry } from '@/core/db/types'
import type { Database } from '@/core/supabase/database'
import type { SyncContext } from '@/core/sync/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SCORE_ADAPTER, SCORE_OPERATIONS, type ScoreWritePayload } from '../../ScoreKeeper'
import { ScoreSyncAdapter } from '../ScoreSyncAdapter'

describe('ScoreSyncAdapter', () => {
  let db: HandiBabyDatabase
  let adapter: ScoreSyncAdapter

  beforeEach(() => {
    db = new HandiBabyDatabase(`test-${crypto.randomUUID()}`)
    adapter = new ScoreSyncAdapter()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('has the expected adapter name', () => {
    expect(adapter.name).toBe(SCORE_ADAPTER)
  })

  it('pushes record-score operation via RPC', async () => {
    const rpcMock = vi.fn<() => Promise<{ data: null; error: null }>>().mockResolvedValue({
      data: null,
      error: null,
    })
    const client = { rpc: rpcMock } as unknown as SupabaseClient<Database, 'app_handibaby'>

    const payload: ScoreWritePayload = {
      journalEntryId: 'entry-1',
      tournamentPublicId: 'tourn-1',
      phase: 'round-robin',
      duel: 1,
      rankInDuel: 1,
      winningSide: 'blue',
      loserScore: 4,
      previous: null,
      writtenAt: 123456789,
    }

    const entry: OutboxEntry<ScoreWritePayload> = {
      id: 1,
      adapter: SCORE_ADAPTER,
      operation: SCORE_OPERATIONS.record,
      payload,
      createdAt: 123456789,
      attempts: 0,
      lastError: null,
    }

    const context: SyncContext = {
      client,
      db,
      cursor: null,
    }

    await adapter.push(entry, context)

    expect(rpcMock).toHaveBeenCalledWith('record_score', {
      p_journal_entry_id: 'entry-1',
      p_tournament_public_id: 'tourn-1',
      p_phase: 'round-robin',
      p_duel: 1,
      p_rank_in_duel: 1,
      p_winning_side: 'blue',
      p_loser_score: 4,
      p_written_at: 123456789,
    })
  })

  it('pushes correct-score operation via RPC', async () => {
    const rpcMock = vi.fn<() => Promise<{ data: null; error: null }>>().mockResolvedValue({
      data: null,
      error: null,
    })
    const client = { rpc: rpcMock } as unknown as SupabaseClient<Database, 'app_handibaby'>

    const payload: ScoreWritePayload = {
      journalEntryId: 'entry-2',
      tournamentPublicId: 'tourn-1',
      phase: 'round-robin',
      duel: 1,
      rankInDuel: 2,
      winningSide: 'white',
      loserScore: 8,
      previous: { winningSide: 'blue', loserScore: 3 },
      writtenAt: 123456799,
    }

    const entry: OutboxEntry<ScoreWritePayload> = {
      id: 2,
      adapter: SCORE_ADAPTER,
      operation: SCORE_OPERATIONS.correct,
      payload,
      createdAt: 123456799,
      attempts: 0,
      lastError: null,
    }

    const context: SyncContext = {
      client,
      db,
      cursor: null,
    }

    await adapter.push(entry, context)

    expect(rpcMock).toHaveBeenCalledWith('correct_score', {
      p_journal_entry_id: 'entry-2',
      p_tournament_public_id: 'tourn-1',
      p_phase: 'round-robin',
      p_duel: 1,
      p_rank_in_duel: 2,
      p_winning_side: 'white',
      p_loser_score: 8,
      p_previous: { winningSide: 'blue', loserScore: 3 },
      p_written_at: 123456799,
    })
  })

  it('pulls remote records and applies them to local matches and journal', async () => {
    const tournamentId = await db.tournaments.add({
      publicId: 'tourn-abc',
      label: 'Test Tournament',
      startDate: '2026-08-19',
      status: 'round-robin',
      passphraseHash: 'hash',
      createdAt: 1000,
    })

    const matchId = await db.matches.add({
      tournamentId,
      phase: 'round-robin',
      duel: 1,
      rankInDuel: 1,
      blueTeamId: 10,
      whiteTeamId: 20,
      blueDefenderId: 1,
      blueAttackerId: 2,
      whiteDefenderId: 3,
      whiteAttackerId: 4,
      winnerTeamId: null,
      loserScore: null,
      enteredAt: null,
    })

    const remoteRecords = [
      {
        entry_id: 'remote-entry-1',
        tournament_public_id: 'tourn-abc',
        phase: 'round-robin',
        duel: 1,
        rank_in_duel: 1,
        operation: 'record',
        winning_side: 'blue',
        loser_score: 5,
        previous: null,
        written_at: 2000,
      },
    ]

    const orderMock = vi
      .fn<() => Promise<{ data: typeof remoteRecords; error: null }>>()
      .mockResolvedValue({ data: remoteRecords, error: null })
    const selectMock = vi.fn<() => { order: typeof orderMock }>().mockReturnValue({
      order: orderMock,
    })
    const fromMock = vi.fn<() => { select: typeof selectMock }>().mockReturnValue({
      select: selectMock,
    })
    const client = { from: fromMock } as unknown as SupabaseClient<Database, 'app_handibaby'>

    const context: SyncContext = {
      client,
      db,
      cursor: null,
    }

    const nextCursor = await adapter.pull(context)

    expect(nextCursor).toBe('2000')

    const updatedMatch = await db.matches.get(matchId)
    expect(updatedMatch?.winnerTeamId).toBe(10)
    expect(updatedMatch?.loserScore).toBe(5)
    expect(updatedMatch?.enteredAt).toBe(2000)

    const journalEntries = await db.journal.toArray()
    expect(journalEntries).toHaveLength(1)
    expect(journalEntries[0]?.entryId).toBe('remote-entry-1')
  })
})
