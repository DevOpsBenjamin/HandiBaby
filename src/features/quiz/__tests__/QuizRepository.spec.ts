import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { HandiBabyDatabase } from '@/core/db/database'
import { QuizRepository } from '../QuizRepository'

let open: HandiBabyDatabase | null = null

function buildRepository(): QuizRepository {
  open = new HandiBabyDatabase(`test-quiz-${crypto.randomUUID()}`)
  return new QuizRepository(open)
}

afterEach(async () => {
  await open?.delete()
  open = null
})

describe('QuizRepository', () => {
  it('saves an attempt and retrieves it sorted newest first', async () => {
    const repo = buildRepository()

    await repo.saveAttempt({
      candidateName: 'Benjamin',
      score: 0,
      totalQuestions: 20,
      answers: { 1: ['a'] },
      completedAt: 1000,
    })

    await repo.saveAttempt({
      candidateName: 'Lucas',
      score: 2,
      totalQuestions: 20,
      answers: { 1: ['a', 'c'] },
      completedAt: 2000,
    })

    const list = await repo.listAttempts()
    expect(list).toHaveLength(2)
    expect(list[0]?.candidateName).toBe('Lucas')
    expect(list[0]?.score).toBe(2)
    expect(list[1]?.candidateName).toBe('Benjamin')
    expect(list[1]?.score).toBe(0)
  })
})
