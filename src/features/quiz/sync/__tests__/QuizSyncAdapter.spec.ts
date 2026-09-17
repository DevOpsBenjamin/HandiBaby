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
    it('pushes quiz attempt via save_quiz_attempt RPC', async () => {
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

      expect(rpcMock).toHaveBeenCalledWith('save_quiz_attempt', {
        p_public_id: 'uuid-1234',
        p_candidate_name: 'Benjamin',
        p_score: 0,
        p_total_questions: 20,
        p_answers: { 1: ['none'] },
        p_completed_at: 1700000000000,
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
    it('pulls remote quiz attempts from quiz_attempts into indexedDB', async () => {
      const selectMock = vi
        .fn<
          () => Promise<{
            data: Array<{
              id: number
              public_id: string
              candidate_name: string
              score: number
              total_questions: number
              answers: Record<number, string[]>
              completed_at: number
              created_at: string
            }>
            error: null
          }>
        >()
        .mockResolvedValue({
          data: [
            {
              id: 1,
              public_id: 'uuid-remote-1',
              candidate_name: 'Lucas',
              score: 3,
              total_questions: 20,
              answers: { 1: ['a', 'c'] },
              completed_at: 1700000050000,
              created_at: '2026-09-17T08:00:00Z',
            },
          ],
          error: null,
        })

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

      expect(fromMock).toHaveBeenCalledWith('quiz_attempts')
      expect(selectMock).toHaveBeenCalledWith('*')

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

      const selectMock = vi
        .fn<
          () => Promise<{
            data: Array<{
              id: number
              public_id: string
              candidate_name: string
              score: number
              total_questions: number
              answers: Record<number, string[]>
              completed_at: number
              created_at: string
            }>
            error: null
          }>
        >()
        .mockResolvedValue({
          data: [
            {
              id: 2,
              public_id: 'uuid-existing',
              candidate_name: 'Existing',
              score: 5,
              total_questions: 20,
              answers: {},
              completed_at: 1000,
              created_at: '2026-09-17T08:00:00Z',
            },
          ],
          error: null,
        })

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
