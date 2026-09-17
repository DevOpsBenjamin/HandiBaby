import { describe, expect, it } from 'vitest'
import { calculateQuizScore, evaluateQuestion, getTrollingVerdict } from '../scoring'
import type { QuizQuestion } from '../types'

describe('Quiz scoring logic', () => {
  const multiAnswerQuestion: QuizQuestion = {
    id: 1,
    page: 1,
    question: 'Question test multi',
    options: [
      { id: 'a', label: 'Reponse A' },
      { id: 'b', label: 'Reponse B' },
      { id: 'c', label: 'Reponse C' },
      { id: 'none', label: 'Aucune de ces reponses' },
    ],
    correctAnswers: ['a', 'c'],
    explanation: 'Explication test',
  }

  const noneAnswerQuestion: QuizQuestion = {
    id: 2,
    page: 2,
    question: 'Question test none',
    options: [
      { id: 'a', label: 'Reponse A' },
      { id: 'b', label: 'Reponse B' },
      { id: 'none', label: 'Aucune de ces reponses' },
    ],
    correctAnswers: ['none'],
    explanation: 'Explication none',
  }

  it('marks as fully correct when all expected answers are selected', () => {
    const evaluation = evaluateQuestion(multiAnswerQuestion, ['a', 'c'])
    expect(evaluation.isFullyCorrect).toBe(true)
    expect(evaluation.isIncomplete).toBe(false)
    expect(evaluation.isWrong).toBe(false)
    expect(evaluation.isUnanswered).toBe(false)
  })

  it('marks as incomplete and NOT fully correct when only 1 of 2 required answers is chosen', () => {
    const evaluation = evaluateQuestion(multiAnswerQuestion, ['a'])
    expect(evaluation.isFullyCorrect).toBe(false)
    expect(evaluation.isIncomplete).toBe(true)
    expect(evaluation.isWrong).toBe(false)
  })

  it('marks as wrong when a wrong answer is added to expected answers', () => {
    const evaluation = evaluateQuestion(multiAnswerQuestion, ['a', 'b', 'c'])
    expect(evaluation.isFullyCorrect).toBe(false)
    expect(evaluation.isIncomplete).toBe(false)
    expect(evaluation.isWrong).toBe(true)
  })

  it('marks as wrong when only wrong answers are chosen', () => {
    const evaluation = evaluateQuestion(multiAnswerQuestion, ['b'])
    expect(evaluation.isFullyCorrect).toBe(false)
    expect(evaluation.isIncomplete).toBe(false)
    expect(evaluation.isWrong).toBe(true)
  })

  it('marks as unanswered when empty', () => {
    const evaluation = evaluateQuestion(multiAnswerQuestion, [])
    expect(evaluation.isUnanswered).toBe(true)
    expect(evaluation.isFullyCorrect).toBe(false)
  })

  it('handles question where none is the expected answer', () => {
    const evalCorrect = evaluateQuestion(noneAnswerQuestion, ['none'])
    expect(evalCorrect.isFullyCorrect).toBe(true)

    const evalWrong = evaluateQuestion(noneAnswerQuestion, ['a'])
    expect(evalWrong.isFullyCorrect).toBe(false)
    expect(evalWrong.isWrong).toBe(true)
  })

  it('calculates full quiz score correctly, giving 0 for incomplete questions', () => {
    const result = calculateQuizScore(
      [multiAnswerQuestion, noneAnswerQuestion],
      {
        1: ['a'], // incomplete -> 0 pts
        2: ['none'], // correct -> 1 pt
      },
    )

    expect(result.score).toBe(1)
    expect(result.total).toBe(2)
    expect(result.evaluations[1]?.isIncomplete).toBe(true)
    expect(result.evaluations[2]?.isFullyCorrect).toBe(true)
  })

  it('returns appropriate troll message for 0/20', () => {
    const verdict = getTrollingVerdict(0, 20)
    expect(verdict.title).toContain('0 / 20')
    expect(verdict.emoji).toBe('💀')
  })
})
