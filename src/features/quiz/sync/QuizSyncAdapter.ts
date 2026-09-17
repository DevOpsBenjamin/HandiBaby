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

      const { error } = await context.client.rpc('sync_tournament_bundle', {
        p_tournament: {
          public_id: 'quiz-' + attempt.publicId,
          label: `Quiz - ${attempt.candidateName} (${attempt.score}/${attempt.totalQuestions})`,
          start_date: new Date(attempt.completedAt).toISOString().split('T')[0],
          status: 'quiz',
          passphrase_hash: 'quiz',
          created_at: attempt.completedAt,
        } as unknown as Json,
        p_players: [],
        p_tournament_players: [],
        p_teams: [],
        p_matches: [],
        p_frozen_edition: {
          data: {
            type: 'quiz_attempt',
            publicId: attempt.publicId,
            candidateName: attempt.candidateName,
            score: attempt.score,
            totalQuestions: attempt.totalQuestions,
            answers: attempt.answers,
            completedAt: attempt.completedAt,
          },
          frozen_at: attempt.completedAt,
        } as unknown as Json,
      })

      if (error) {
        throw new Error(`Failed to push quiz attempt to Supabase: ${error.message}`)
      }
    }
  }

  async pull(context: SyncContext): Promise<string | null> {
    const { data: rows, error } = await context.client
      .from('frozen_editions')
      .select('*')
      .like('tournament_public_id', 'quiz-%')

    if (error || !rows) {
      return String(Date.now())
    }

    for (const row of rows) {
      const payload = row.data as Record<string, unknown>
      if (payload && payload.type === 'quiz_attempt' && typeof payload.publicId === 'string') {
        const publicId = payload.publicId
        const existing = await context.db.quizAttempts.where('publicId').equals(publicId).first()
        if (!existing) {
          await context.db.quizAttempts.add({
            publicId,
            candidateName: String(payload.candidateName || 'Anonyme'),
            score: Number(payload.score || 0),
            totalQuestions: Number(payload.totalQuestions || 20),
            answers: (payload.answers as Record<number, string[]>) || {},
            completedAt: Number(payload.completedAt || row.frozen_at || Date.now()),
          })
        }
      }
    }

    return String(Date.now())
  }
}
