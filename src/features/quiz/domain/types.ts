export interface QuizOption {
  id: string
  label: string
}

export interface QuizQuestion {
  id: number
  page: number
  question: string
  options: QuizOption[]
  correctAnswers: string[]
  explanation: string
}

export interface QuestionEvaluation {
  questionId: number
  selectedAnswers: string[]
  expectedAnswers: string[]
  isFullyCorrect: boolean
  isIncomplete: boolean
  isWrong: boolean
  isUnanswered: boolean
}

export interface QuizAttempt {
  id?: number
  publicId: string
  candidateName: string
  score: number
  totalQuestions: number
  answers: Record<number, string[]>
  completedAt: number
}
