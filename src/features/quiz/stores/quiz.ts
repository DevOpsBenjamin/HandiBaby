import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db, gateway, syncEngine } from '@/core/container'
import { QuizRepository } from '../QuizRepository'
import { QUIZ_QUESTIONS } from '../domain/questions'
import { calculateQuizScore, getTrollingVerdict, type TrollingVerdict } from '../domain/scoring'
import type { QuizAttempt } from '../domain/types'

const repository = new QuizRepository(db)

export const useQuizStore = defineStore('quiz', () => {
  const candidateName = ref('')
  const currentAttemptPublicId = ref<string | null>(null)
  const currentQuestionIndex = ref(0)
  const answers = ref<Record<number, string[]>>({})
  const isStarted = ref(false)
  const isSubmitted = ref(false)
  const isSaving = ref(false)
  const attempts = ref<QuizAttempt[]>([])
  const loadingAttempts = ref(false)
  const isSharedView = ref(false)

  const currentQuestion = computed(() => QUIZ_QUESTIONS[currentQuestionIndex.value])
  const totalQuestions = computed(() => QUIZ_QUESTIONS.length)
  const progressPercent = computed(() =>
    Math.round(((currentQuestionIndex.value + 1) / totalQuestions.value) * 100),
  )

  const scoreResult = computed(() => calculateQuizScore(QUIZ_QUESTIONS, answers.value))

  const verdict = computed<TrollingVerdict>(() =>
    getTrollingVerdict(scoreResult.value.score, totalQuestions.value),
  )

  const isCurrentQuestionAnswered = computed(() => {
    const qId = currentQuestion.value?.id
    if (!qId) return false
    return (answers.value[qId]?.length ?? 0) > 0
  })

  const answeredCount = computed(() => {
    return QUIZ_QUESTIONS.filter((q) => (answers.value[q.id]?.length ?? 0) > 0).length
  })

  function toggleAnswer(questionId: number, optionId: string): void {
    if (isSubmitted.value) return

    const currentList = answers.value[questionId] ? [...answers.value[questionId]] : []

    if (optionId === 'none') {
      // If clicking 'none', toggle it and clear all other options
      if (currentList.includes('none')) {
        answers.value[questionId] = []
      } else {
        answers.value[questionId] = ['none']
      }
      return
    }

    // If clicking any other option, remove 'none' if present
    const withoutNone = currentList.filter((id) => id !== 'none')
    const idx = withoutNone.indexOf(optionId)
    if (idx >= 0) {
      withoutNone.splice(idx, 1)
    } else {
      withoutNone.push(optionId)
    }

    answers.value[questionId] = withoutNone
  }

  function startQuiz(name: string): void {
    candidateName.value = name.trim()
    currentAttemptPublicId.value = crypto.randomUUID()
    currentQuestionIndex.value = 0
    answers.value = {}
    isStarted.value = true
    isSubmitted.value = false
    isSharedView.value = false
  }

  function nextQuestion(): void {
    if (currentQuestionIndex.value < totalQuestions.value - 1) {
      currentQuestionIndex.value += 1
    }
  }

  function prevQuestion(): void {
    if (currentQuestionIndex.value > 0) {
      currentQuestionIndex.value -= 1
    }
  }

  function goToQuestion(index: number): void {
    if (index >= 0 && index < totalQuestions.value) {
      currentQuestionIndex.value = index
    }
  }

  async function submitQuiz(): Promise<QuizAttempt | null> {
    if (isSubmitted.value || isSaving.value) return null
    isSaving.value = true

    try {
      // Serialize to plain JSON to avoid Vue reactive proxy clone errors in IndexedDB
      const rawAnswers: Record<number, string[]> = JSON.parse(JSON.stringify(answers.value))
      const publicId = currentAttemptPublicId.value || crypto.randomUUID()

      const saved = await repository.saveAttempt({
        publicId,
        candidateName: candidateName.value,
        score: scoreResult.value.score,
        totalQuestions: totalQuestions.value,
        answers: rawAnswers,
        completedAt: Date.now(),
      })

      currentAttemptPublicId.value = saved.publicId
      isSubmitted.value = true
      isSharedView.value = false

      await loadAttempts()

      // Trigger immediate sync in the background so it reaches Supabase
      void syncEngine.sync()

      return saved
    } finally {
      isSaving.value = false
    }
  }

  async function loadResultById(publicId: string): Promise<boolean> {
    // 1. Check local database
    let attempt = await repository.findByPublicId(publicId)

    // 2. If not found locally, fetch directly from Supabase
    if (!attempt && gateway.isConfigured) {
      const client = gateway.tryGetClient()
      if (client) {
        try {
          const { data } = await client
            .from('frozen_editions')
            .select('*')
            .eq('tournament_public_id', 'quiz-' + publicId)
            .single()

          const payload = data?.data as Record<string, unknown> | null
          if (payload && payload.type === 'quiz_attempt') {
            attempt = await repository.saveAttemptLocally({
              publicId,
              candidateName: String(payload.candidateName || 'Victime'),
              score: Number(payload.score || 0),
              totalQuestions: Number(payload.totalQuestions || 20),
              answers: (payload.answers as Record<number, string[]>) || {},
              completedAt: Number(payload.completedAt || data?.frozen_at || Date.now()),
            })
          }
        } catch {
          // Network or parsing error, fallback to false
        }
      }
    }

    if (attempt) {
      candidateName.value = attempt.candidateName
      answers.value = { ...attempt.answers }
      currentAttemptPublicId.value = attempt.publicId
      isStarted.value = true
      isSubmitted.value = true
      isSharedView.value = true
      return true
    }

    return false
  }

  async function loadAttempts(): Promise<void> {
    loadingAttempts.value = true
    try {
      attempts.value = await repository.listAttempts()
    } finally {
      loadingAttempts.value = false
    }
  }

  function restartQuiz(): void {
    isStarted.value = false
    isSubmitted.value = false
    isSharedView.value = false
    answers.value = {}
    currentQuestionIndex.value = 0
    currentAttemptPublicId.value = null
  }

  return {
    candidateName,
    currentAttemptPublicId,
    currentQuestionIndex,
    currentQuestion,
    totalQuestions,
    progressPercent,
    answers,
    isStarted,
    isSubmitted,
    isSaving,
    isSharedView,
    attempts,
    loadingAttempts,
    scoreResult,
    verdict,
    isCurrentQuestionAnswered,
    answeredCount,
    toggleAnswer,
    startQuiz,
    nextQuestion,
    prevQuestion,
    goToQuestion,
    submitQuiz,
    loadResultById,
    loadAttempts,
    restartQuiz,
  }
})
