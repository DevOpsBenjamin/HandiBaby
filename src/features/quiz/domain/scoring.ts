import type { QuestionEvaluation, QuizQuestion } from './types'

export function evaluateQuestion(
  question: QuizQuestion,
  selected: string[] = [],
): QuestionEvaluation {
  const expectedSet = new Set(question.correctAnswers)

  const isUnanswered = selected.length === 0

  // Check if every selected answer is in the expected answers set
  const hasOnlyExpected = selected.length > 0 && selected.every((s) => expectedSet.has(s))

  // Fully correct: length matches and all selected are expected
  const isFullyCorrect =
    selected.length === question.correctAnswers.length && hasOnlyExpected

  // Incomplete: only selected valid expected answers, but missed at least one
  const isIncomplete =
    hasOnlyExpected && selected.length < question.correctAnswers.length

  // Wrong: selected at least one wrong answer, or selected both wrong and right
  const isWrong = !isFullyCorrect && !isIncomplete && !isUnanswered

  return {
    questionId: question.id,
    selectedAnswers: selected,
    expectedAnswers: question.correctAnswers,
    isFullyCorrect,
    isIncomplete,
    isWrong,
    isUnanswered,
  }
}

export function calculateQuizScore(
  questions: QuizQuestion[],
  answers: Record<number, string[]>,
): {
  score: number
  total: number
  evaluations: Record<number, QuestionEvaluation>
} {
  let score = 0
  const evaluations: Record<number, QuestionEvaluation> = {}

  for (const q of questions) {
    const evalResult = evaluateQuestion(q, answers[q.id] ?? [])
    evaluations[q.id] = evalResult
    if (evalResult.isFullyCorrect) {
      score += 1
    }
  }

  return {
    score,
    total: questions.length,
    evaluations,
  }
}

export interface TrollingVerdict {
  emoji: string
  title: string
  message: string
}

export function getTrollingVerdict(score: number, total = 20): TrollingVerdict {
  if (score === 0) {
    return {
      emoji: '💀',
      title: '0 / 20 — Le néant absolu',
      message:
        'Tu n’as manifestement pas ouvert le PDF hier soir ! Le baby-foot c’est pas fait pour toi, retourne potasser les 51 pages avant de prétendre retoucher une barre.',
    }
  }
  if (score <= 4) {
    return {
      emoji: '🤦‍♂️',
      title: `${score} / ${total} — Naufrage complet`,
      message:
        'C’est à peine mieux que le hasard le plus total. La commission formation de la FFFT a des sueurs froides rien qu’en regardant ta feuille.',
    }
  }
  if (score <= 9) {
    return {
      emoji: '😬',
      title: `${score} / ${total} — Très insuffisant`,
      message:
        'Tu as dû lire le titre et le sommaire en diagonale. Sur les questions à choix multiples pièges, tu as pris l’eau de partout !',
    }
  }
  if (score <= 15) {
    return {
      emoji: '🤨',
      title: `${score} / ${total} — Presque honorable`,
      message:
        'Pas trop mal, tu as dû survoler quelques fiches ! Mais la FFFT n’admet aucun à-peu-près : un choix manqué et c’est zéro pointé.',
    }
  }
  if (score < 20) {
    return {
      emoji: '🧐',
      title: `${score} / ${total} — Presque parfait`,
      message:
        'Impressionnant ! Tu as vraiment potassé le guide. Seuls quelques pièges diaboliques t’ont empêché de décrocher le 20/20.',
    }
  }
  return {
    emoji: '👑',
    title: '20 / 20 — Maître formateur FFFT',
    message:
      '20 sur 20 ?! Soit tu as le PDF ouvert sous les yeux, soit tu t’appelles Damien Benéteau ou Alexandre Berlemont. Respect infini !',
  }
}
