import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import type { Database } from '@/core/supabase/database'
import type { SyncContext } from '@/core/sync/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { QUIZ_ADAPTER, QUIZ_OPERATIONS } from '../../QuizRepository'
import { QuizSyncAdapter } from '../QuizSyncAdapter'

describe('QuizSyncAdapter', () => {
  let db: HandiBabyDatabase
  let adapter: QuizSyncAdapter

  beforeEach(() => {
    db = new HandiBabyDatabase(`test-quiz-sync-${crypto.randomUUID()}`)
    adapter = new QuizSyncAdapter()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('has the expected adapter name', () => {
    expect(adapter.name).toBe(QUIZ_ADAPTER)
  })

  describe('push', () => {
    it('pushes quiz attempt via sync_tournament_bundle RPC', async () => {
      const rpcMock = vi.fn<() => Promise<{ data: null; error: null }>>().mockResolvedValue({
        data: null,
        error: null,
      })
      const client = { rpc: rpcMock } as unknown as SupabaseClient<Database, 'app_handibaby'>

      const context: SyncContext = {
        client,
        db,
        cursor: null,
      }

      await adapter.push(
        {
          id: 1,
          adapter: QUIZ_ADAPTER,
          operation: QUIZ_OPERATIONS.save,
          payload: {
            publicId: 'uuid-1234',
            candidateName: 'Benjamin',
            score: 0,
            totalQuestions: 20,
            answers: { 1: ['none'] },
            completedAt: 1700000000000,
          },
          createdAt: 1700000000000,
          attempts: 0,
          lastError: null,
        },
        context,
      )

      expect(rpcMock).toHaveBeenCalledWith('sync_tournament_bundle', {
        p_tournament: {
          public_id: 'quiz-uuid-1234',
          label: 'Quiz - Benjamin (0/20)',
          start_date: new Date(1700000000000).toISOString().split('T')[0],
          status: 'quiz',
          passphrase_hash: 'quiz',
          created_at: 1700000000000,
        },
        p_players: [],
        p_tournament_players: [],
        p_teams: [],
        p_matches: [],
        p_frozen_edition: {
          data: {
            type: 'quiz_attempt',
            publicId: 'uuid-1234',
            candidateName: 'Benjamin',
            score: 0,
            totalQuestions: 20,
            answers: { 1: ['none'] },
            completedAt: 1700000000000,
          },
          frozen_at: 1700000000000,
        },
      })
    })

    it('throws error when RPC returns an error', async () => {
      const rpcMock = vi
        .fn<() => Promise<{ error: { message: string } }>>()
        .mockResolvedValue({ error: { message: 'Database error' } })
      const client = { rpc: rpcMock } as unknown as SupabaseClient<Database, 'app_handibaby'>

      const context: SyncContext = {
        client,
        db,
        cursor: null,
      }

      await expect(
        adapter.push(
          {
            id: 1,
            adapter: QUIZ_ADAPTER,
            operation: QUIZ_OPERATIONS.save,
            payload: {
              publicId: 'uuid-error',
              candidateName: 'Benjamin',
              score: 0,
              totalQuestions: 20,
              answers: {},
              completedAt: 1700000000000,
            },
            createdAt: 1700000000000,
            attempts: 0,
            lastError: null,
          },
          context,
        ),
      ).rejects.toThrow('Failed to push quiz attempt to Supabase: Database error')
    })
  })

  describe('pull', () => {
    it('pulls remote quiz attempts from frozen_editions into indexedDB', async () => {
      const likeMock = vi
        .fn<
          () => Promise<{
            data: Array<{
              tournament_public_id: string
              frozen_at: number
              data: {
                type: string
                publicId: string
                candidateName: string
                score: number
                totalQuestions: number
                answers: Record<number, string[]>
                completedAt: number
              }
            }>
            error: null
          }>
        >()
        .mockResolvedValue({
          data: [
            {
              tournament_public_id: 'quiz-uuid-remote-1',
              frozen_at: 1700000050000,
              data: {
                type: 'quiz_attempt',
                publicId: 'uuid-remote-1',
                candidateName: 'Lucas',
                score: 3,
                totalQuestions: 20,
                answers: { 1: ['a', 'c'] },
                completedAt: 1700000050000,
              },
            },
          ],
          error: null,
        })

      const selectMock = vi
        .fn<() => { like: typeof likeMock }>()
        .mockReturnValue({ like: likeMock })
      const fromMock = vi
        .fn<() => { select: typeof selectMock }>()
        .mockReturnValue({ select: selectMock })
      const client = { from: fromMock } as unknown as SupabaseClient<Database, 'app_handibaby'>

      const context: SyncContext = {
        client,
        db,
        cursor: null,
      }

      await adapter.pull(context)

      expect(fromMock).toHaveBeenCalledWith('frozen_editions')
      expect(selectMock).toHaveBeenCalledWith('*')
      expect(likeMock).toHaveBeenCalledWith('tournament_public_id', 'quiz-%')

      const saved = await db.quizAttempts.where('publicId').equals('uuid-remote-1').first()
      expect(saved).toBeDefined()
      expect(saved?.candidateName).toBe('Lucas')
      expect(saved?.score).toBe(3)
      expect(saved?.answers).toEqual({ 1: ['a', 'c'] })
    })

    it('does not duplicate existing attempt on pull', async () => {
      await db.quizAttempts.add({
        publicId: 'uuid-existing',
        candidateName: 'Existing',
        score: 5,
        totalQuestions: 20,
        answers: {},
        completedAt: 1000,
      })

      const likeMock = vi
        .fn<
          () => Promise<{
            data: Array<{
              tournament_public_id: string
              data: {
                type: string
                publicId: string
                candidateName: string
                score: number
                totalQuestions: number
                answers: Record<number, string[]>
              }
            }>
            error: null
          }>
        >()
        .mockResolvedValue({
          data: [
            {
              tournament_public_id: 'quiz-uuid-existing',
              data: {
                type: 'quiz_attempt',
                publicId: 'uuid-existing',
                candidateName: 'Existing',
                score: 5,
                totalQuestions: 20,
                answers: {},
              },
            },
          ],
          error: null,
        })

      const selectMock = vi
        .fn<() => { like: typeof likeMock }>()
        .mockReturnValue({ like: likeMock })
      const fromMock = vi
        .fn<() => { select: typeof selectMock }>()
        .mockReturnValue({ select: selectMock })
      const client = { from: fromMock } as unknown as SupabaseClient<Database, 'app_handibaby'>

      const context: SyncContext = {
        client,
        db,
        cursor: null,
      }

      await adapter.pull(context)

      const count = await db.quizAttempts.where('publicId').equals('uuid-existing').count()
      expect(count).toBe(1)
    })
  })
})
