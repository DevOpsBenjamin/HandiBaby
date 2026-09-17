import type { OutboxEntry } from '@/core/db/types'
import type { Json } from '@/core/supabase/database'
import type { SyncAdapter, SyncContext } from '@/core/sync/types'
import { QUIZ_ADAPTER, QUIZ_OPERATIONS } from '../QuizRepository'
import type { QuizAttempt } from '../domain/types'

export class QuizSyncAdapter implements SyncAdapter<QuizAttempt> {
  readonly name = QUIZ_ADAPTER

  async push(entry: OutboxEntry<QuizAttempt>, context: SyncContext): Promise<void> {
    if (entry.operation === QUIZ_OPERATIONS.save) {
      const attempt = entry.payload

      const { error } = await context.client.rpc('save_quiz_attempt', {
        p_public_id: attempt.publicId,
        p_candidate_name: attempt.candidateName,
        p_score: attempt.score,
        p_total_questions: attempt.totalQuestions,
        p_answers: attempt.answers as unknown as Json,
        p_completed_at: attempt.completedAt,
      })

      if (error) {
        throw new Error(`Failed to push quiz attempt to Supabase: ${error.message}`)
      }
    }
  }

  async pull(context: SyncContext): Promise<string | null> {
    const { data: rows, error } = await context.client
      .from('quiz_attempts')
      .select('*')

    if (error || !rows) {
      return String(Date.now())
    }

    for (const row of rows) {
      const existing = await context.db.quizAttempts.where('publicId').equals(row.public_id).first()
      if (!existing) {
        await context.db.quizAttempts.add({
          publicId: row.public_id,
          candidateName: row.candidate_name,
          score: row.score,
          totalQuestions: row.total_questions,
          answers: (row.answers as Record<number, string[]>) || {},
          completedAt: row.completed_at,
        })
      }
    }

    return String(Date.now())
  }
}
