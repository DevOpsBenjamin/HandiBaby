import type { HandiBabyDatabase } from '@/core/db/database'
import type { QuizAttempt } from './domain/types'

export const QUIZ_ADAPTER = 'quiz'
export const QUIZ_OPERATIONS = {
  save: 'save-quiz-attempt',
} as const

export class QuizRepository {
  readonly #db: HandiBabyDatabase

  constructor(db: HandiBabyDatabase) {
    this.#db = db
  }

  async saveAttempt(
    attempt: Omit<QuizAttempt, 'id' | 'publicId'> & { publicId?: string },
  ): Promise<QuizAttempt> {
    const publicId = attempt.publicId || crypto.randomUUID()
    const record: QuizAttempt = {
      ...attempt,
      publicId,
      candidateName: attempt.candidateName.trim(),
    }

    const id = await this.#db.quizAttempts.add(record)
    const saved = { ...record, id }

    // Queue in outbox so the sync engine pushes it to Supabase
    await this.#db.outbox.add({
      adapter: QUIZ_ADAPTER,
      operation: QUIZ_OPERATIONS.save,
      payload: saved,
      createdAt: Date.now(),
      attempts: 0,
      lastError: null,
    })

    return saved
  }

  async saveAttemptLocally(attempt: QuizAttempt): Promise<QuizAttempt> {
    const existing = await this.findByPublicId(attempt.publicId)
    if (existing) {
      return existing
    }
    const id = await this.#db.quizAttempts.add(attempt)
    return { ...attempt, id }
  }

  async findByPublicId(publicId: string): Promise<QuizAttempt | undefined> {
    return this.#db.quizAttempts.where('publicId').equals(publicId).first()
  }

  async listAttempts(): Promise<QuizAttempt[]> {
    const attempts = await this.#db.quizAttempts.toArray()
    return attempts.sort((a, b) => b.completedAt - a.completedAt)
  }

  async clearAttempts(): Promise<void> {
    await this.#db.quizAttempts.clear()
  }
}
