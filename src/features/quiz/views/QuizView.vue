<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { usePlayerPoolStore } from '@/features/players/stores/pool'
import { QUIZ_QUESTIONS } from '../domain/questions'
import { useQuizStore } from '../stores/quiz'

const route = useRoute()
const quiz = useQuizStore()
const playerPool = usePlayerPoolStore()

const selectedPlayerKey = ref('')
const showAttemptsList = ref(false)
const copied = ref(false)
let copiedTimeout: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  await Promise.all([playerPool.load(), quiz.loadAttempts()])

  const targetPublicId =
    (route?.params?.publicId as string | undefined) ||
    (route?.query?.result as string | undefined)

  if (targetPublicId) {
    await quiz.loadResultById(targetPublicId)
  } else if (quiz.candidateName) {
    const found = playerPool.players.find(
      (p) => `${p.firstName} ${p.lastName}`.trim().toLowerCase() === quiz.candidateName.toLowerCase(),
    )
    if (found) {
      selectedPlayerKey.value = found.nameKey
    }
  }
})

const selectedPlayer = computed(() =>
  playerPool.players.find((p) => p.nameKey === selectedPlayerKey.value),
)

const canStart = computed(() => Boolean(selectedPlayer.value))

function handleStart(): void {
  if (!selectedPlayer.value) return
  const fullName = `${selectedPlayer.value.firstName} ${selectedPlayer.value.lastName}`.trim()
  quiz.startQuiz(fullName)
}

function copyShareLink(): void {
  const publicId = quiz.currentAttemptPublicId
  if (!publicId) return
  const url = `${window.location.origin}/quiz/resultat/${publicId}`

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(url).catch(() => fallbackCopy(url))
  } else {
    fallbackCopy(url)
  }

  copied.value = true
  if (copiedTimeout) clearTimeout(copiedTimeout)
  copiedTimeout = setTimeout(() => {
    copied.value = false
  }, 3000)
}

function fallbackCopy(url: string): void {
  const input = document.createElement('input')
  input.value = url
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}
</script>

<template>
  <div class="space-y-8">
    <!-- Navigation Back -->
    <div class="flex items-center justify-between gap-4">
      <RouterLink to="/tournois" class="text-sm text-chalk-400 hover:text-chalk-100">
        ← Retour aux tournois
      </RouterLink>

      <a
        href="https://ffbabyfoot.fr/files/techniques-et-conseils/Guide_p%C3%A9dagogique.pdf"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 text-xs text-ball hover:underline"
      >
        <span>📄 Ouvrir le Guide FFFT (51 pages)</span>
        <span>↗</span>
      </a>
    </div>

    <!-- ========================================================== -->
    <!-- 1. INTRO / START SCREEN -->
    <!-- ========================================================== -->
    <section v-if="!quiz.isStarted && !quiz.isSubmitted" class="space-y-8">
      <header class="space-y-3">
        <div class="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-300">
          <span>🚨 Interrogation Surprise Officielle</span>
        </div>

        <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-chalk-100">
          Le Grand Quiz Pédagogique FFFT
        </h1>

        <p class="text-sm sm:text-base text-chalk-400 max-w-2xl leading-relaxed">
          « Tu lis ça ce soir, demain interrogation pas surprise, bonne chance ! »<br />
          20 questions vicieuses, ultra-détaillées et impitoyables tirées mot pour mot du
          <strong>Guide Pédagogique de la Fédération Française de Football de Table</strong>.
        </p>
      </header>

      <!-- Rules / Traps Card -->
      <div class="rounded-2xl border border-pitch-800 bg-pitch-900 p-6 space-y-4">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-ball flex items-center gap-2">
          <span>⚠️</span> Règlement de l'épreuve
        </h2>

        <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-chalk-400">
          <li class="flex items-start gap-2 bg-pitch-950/60 p-3 rounded-xl border border-pitch-800">
            <span class="text-ball shrink-0">☑️</span>
            <span><strong>Choix multiples possibles :</strong> Chaque question peut comporter 1, 2 ou 3 bonnes réponses.</span>
          </li>
          <li class="flex items-start gap-2 bg-pitch-950/60 p-3 rounded-xl border border-pitch-800">
            <span class="text-rose-400 shrink-0">❌</span>
            <span><strong>Zéro pitié :</strong> Si 2 réponses étaient requises et que tu n'en sélectionnes qu'une seule, tu as <strong>0 point</strong> !</span>
          </li>
          <li class="flex items-start gap-2 bg-pitch-950/60 p-3 rounded-xl border border-pitch-800">
            <span class="text-amber-400 shrink-0">🚫</span>
            <span><strong>L'option « Aucune » :</strong> Présente à chaque question. Et oui, pour certaines questions, c'est la seule bonne réponse !</span>
          </li>
          <li class="flex items-start gap-2 bg-pitch-950/60 p-3 rounded-xl border border-pitch-800">
            <span class="text-sky-400 shrink-0">💾</span>
            <span><strong>Gravé en BDD :</strong> Ton score final sera enregistré dans la base de données locale.</span>
          </li>
        </ul>
      </div>

      <!-- Candidate Selection strictly from Vivier -->
      <div class="rounded-2xl border border-pitch-700 bg-pitch-900/90 p-6 sm:p-8 space-y-6 shadow-xl">
        <div class="space-y-3">
          <label for="player-select" class="block text-sm font-semibold text-chalk-100">
            Sélectionner la victime dans le Vivier :
          </label>

          <div v-if="playerPool.players.length > 0" class="space-y-4">
            <select
              id="player-select"
              v-model="selectedPlayerKey"
              class="w-full rounded-xl border border-pitch-700 bg-pitch-950 px-4 py-3.5 text-base text-chalk-100 outline-none transition focus:border-ball focus:ring-1 focus:ring-ball cursor-pointer"
            >
              <option value="" disabled>-- Choisir un joueur du vivier --</option>
              <option
                v-for="player in playerPool.players"
                :key="player.nameKey"
                :value="player.nameKey"
              >
                {{ player.firstName }} {{ player.lastName }}
              </option>
            </select>

            <!-- Direct Player Selection Cards / Pills -->
            <div class="space-y-2 pt-1">
              <p class="text-xs text-chalk-400">Ou cliquer directement sur son nom :</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="player in playerPool.players"
                  :key="player.nameKey"
                  type="button"
                  class="rounded-lg border px-3 py-1.5 text-xs transition cursor-pointer"
                  :class="
                    selectedPlayerKey === player.nameKey
                      ? 'border-ball bg-ball text-pitch-950 font-bold shadow-xs'
                      : 'border-pitch-800 bg-pitch-950/80 text-chalk-400 hover:border-pitch-700 hover:text-chalk-100'
                  "
                  @click="selectedPlayerKey = player.nameKey"
                >
                  {{ player.firstName }} {{ player.lastName }}
                </button>
              </div>
            </div>
          </div>

          <!-- Empty Vivier Warning -->
          <div v-else class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2.5 text-sm text-amber-200">
            <p class="font-semibold">⚠️ Le Vivier est actuellement vide !</p>
            <p class="text-xs text-amber-300/80 leading-relaxed">
              Pour faire passer l'interrogation surprise à votre collègue, ajoutez-le d'abord dans le vivier de joueurs.
            </p>
            <RouterLink
              to="/joueurs"
              class="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-pitch-950 hover:bg-amber-300 transition"
            >
              <span>Accéder au Vivier de joueurs →</span>
            </RouterLink>
          </div>
        </div>

        <button
          id="start-quiz-btn"
          type="button"
          :disabled="!canStart"
          class="w-full rounded-xl bg-ball py-3.5 text-center font-bold text-pitch-950 transition hover:bg-ball/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer"
          @click="handleStart"
        >
          <span v-if="selectedPlayer">
            Lancer l'interrogation pour {{ selectedPlayer.firstName }} {{ selectedPlayer.lastName }} 🎯
          </span>
          <span v-else>
            Sélectionnez un joueur du vivier pour commencer
          </span>
        </button>
      </div>

      <!-- Past attempts / Hall of shame toggle -->
      <div v-if="quiz.attempts.length > 0" class="space-y-4 pt-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-chalk-400">
            Mur des résultats précédents ({{ quiz.attempts.length }})
          </h3>
          <button
            type="button"
            class="text-xs text-ball hover:underline cursor-pointer"
            @click="showAttemptsList = !showAttemptsList"
          >
            {{ showAttemptsList ? 'Masquer' : 'Afficher' }}
          </button>
        </div>

        <ul v-if="showAttemptsList" class="divide-y divide-pitch-800 rounded-xl bg-pitch-900 border border-pitch-800 overflow-hidden">
          <li
            v-for="attempt in quiz.attempts"
            :key="attempt.id"
            class="flex items-center justify-between px-5 py-3 text-sm hover:bg-pitch-800/60"
          >
            <div>
              <span class="font-semibold text-chalk-100">{{ attempt.candidateName }}</span>
              <span class="ml-2 text-xs text-chalk-400">{{ formatDate(attempt.completedAt) }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span
                class="rounded-full px-2.5 py-0.5 text-xs font-bold"
                :class="
                  attempt.score === 0
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : attempt.score <= 5
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                "
              >
                {{ attempt.score }} / {{ attempt.totalQuestions }}
              </span>
              <button
                type="button"
                class="text-xs text-ball hover:underline cursor-pointer"
                @click="quiz.loadResultById(attempt.publicId)"
              >
                Détails →
              </button>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- ========================================================== -->
    <!-- 2. IN-PROGRESS QUIZ SCREEN (ONE BY ONE) -->
    <!-- ========================================================== -->
    <section v-else-if="quiz.isStarted && !quiz.isSubmitted" class="space-y-6">
      <!-- Top Progress & Candidate info -->
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <div class="flex items-center gap-2">
            <span class="font-bold text-chalk-100">
              Question {{ quiz.currentQuestionIndex + 1 }} / {{ quiz.totalQuestions }}
            </span>
            <span class="text-chalk-400">
              ({{ quiz.answeredCount }} / {{ quiz.totalQuestions }} répondues)
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-chalk-400">Victime :</span>
            <span class="font-semibold text-ball">{{ quiz.candidateName }}</span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="h-2 w-full overflow-hidden rounded-full bg-pitch-900 border border-pitch-800">
          <div
            class="h-full bg-ball transition-all duration-300"
            :style="{ width: `${quiz.progressPercent}%` }"
          />
        </div>

        <!-- Quick Jump Navigation Dots -->
        <div class="flex flex-wrap gap-1.5 pt-1">
          <button
            v-for="(q, idx) in QUIZ_QUESTIONS"
            :key="q.id"
            type="button"
            class="h-7 w-7 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center"
            :class="
              quiz.currentQuestionIndex === idx
                ? 'border-2 border-ball bg-ball text-pitch-950 shadow-sm'
                : (quiz.answers[q.id]?.length ?? 0) > 0
                  ? 'bg-pitch-800 text-chalk-100 hover:bg-pitch-700'
                  : 'bg-pitch-950 text-chalk-400/50 border border-pitch-800 hover:text-chalk-400'
            "
            @click="quiz.goToQuestion(idx)"
          >
            {{ idx + 1 }}
          </button>
        </div>
      </div>

      <!-- Current Question Card -->
      <div
        v-if="quiz.currentQuestion"
        class="rounded-2xl border border-pitch-700 bg-pitch-900 p-6 sm:p-8 space-y-6 shadow-xl"
      >
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-pitch-800 pb-4">
          <span class="rounded-lg bg-pitch-800 px-3 py-1 text-xs font-medium text-chalk-400">
            📖 Source : Guide FFFT, Page {{ quiz.currentQuestion.page }}
          </span>

          <span class="rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300">
            ☑️ Plusieurs choix possibles
          </span>
        </div>

        <h2 class="text-lg sm:text-xl font-bold leading-relaxed text-chalk-100">
          {{ quiz.currentQuestion.question }}
        </h2>

        <!-- Options Checkbox List -->
        <div class="space-y-3 pt-2">
          <button
            v-for="opt in quiz.currentQuestion.options"
            :key="opt.id"
            type="button"
            class="quiz-option-btn w-full text-left rounded-xl p-4 border transition cursor-pointer flex items-start gap-3.5 select-none"
            :class="
              quiz.answers[quiz.currentQuestion.id]?.includes(opt.id)
                ? 'border-ball bg-pitch-800 text-chalk-100 shadow-md ring-1 ring-ball'
                : 'border-pitch-800 bg-pitch-950/70 text-chalk-400 hover:border-pitch-700 hover:text-chalk-100'
            "
            @click="quiz.toggleAnswer(quiz.currentQuestion.id, opt.id)"
          >
            <!-- Checkbox Box Icon -->
            <div
              class="mt-0.5 h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition"
              :class="
                quiz.answers[quiz.currentQuestion.id]?.includes(opt.id)
                  ? 'border-ball bg-ball text-pitch-950'
                  : 'border-pitch-700 bg-pitch-900'
              "
            >
              <svg
                v-if="quiz.answers[quiz.currentQuestion.id]?.includes(opt.id)"
                class="h-3.5 w-3.5 stroke-current stroke-2"
                viewBox="0 0 24 24"
                fill="none"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <!-- Option Text -->
            <div class="flex-1 text-sm sm:text-base leading-snug">
              <span :class="{ 'font-semibold text-amber-300': opt.id === 'none' }">
                {{ opt.label }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Navigation & Submit Footer -->
      <div class="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button
          type="button"
          :disabled="quiz.currentQuestionIndex === 0"
          class="rounded-xl border border-pitch-700 bg-pitch-900 px-5 py-2.5 text-sm font-semibold text-chalk-400 transition hover:border-pitch-600 hover:text-chalk-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          @click="quiz.prevQuestion"
        >
          ← Question précédente
        </button>

        <div class="flex items-center gap-3">
          <button
            v-if="quiz.currentQuestionIndex < quiz.totalQuestions - 1"
            type="button"
            class="rounded-xl bg-pitch-800 hover:bg-pitch-700 border border-pitch-700 px-5 py-2.5 text-sm font-semibold text-chalk-100 transition cursor-pointer"
            @click="quiz.nextQuestion"
          >
            Question suivante →
          </button>

          <button
            type="button"
            :disabled="quiz.isSaving"
            class="rounded-xl bg-ball px-6 py-2.5 text-sm font-bold text-pitch-950 transition hover:bg-ball/90 shadow-md cursor-pointer disabled:opacity-50"
            @click="quiz.submitQuiz"
          >
            {{ quiz.isSaving ? 'Enregistrement...' : 'Valider & voir le massacre 📝' }}
          </button>
        </div>
      </div>
    </section>

    <!-- ========================================================== -->
    <!-- 3. REVIEW SCREEN (INTACT QUIZ + RED / GREEN FEEDBACK) -->
    <!-- ========================================================== -->
    <section v-else-if="quiz.isSubmitted" class="space-y-10">
      <!-- Score Verdict Hero Card -->
      <div class="rounded-3xl border border-pitch-700 bg-pitch-900 p-6 sm:p-10 text-center space-y-4 shadow-2xl">
        <div
          v-if="quiz.isSharedView"
          class="inline-flex items-center gap-2 rounded-full border border-ball/40 bg-ball/10 px-4 py-1.5 text-xs font-semibold text-ball"
        >
          <span>🔗 Résultat partagé synchronisé avec Supabase</span>
        </div>

        <div class="text-6xl sm:text-7xl animate-bounce">
          {{ quiz.verdict.emoji }}
        </div>

        <div class="space-y-1">
          <span class="text-xs uppercase tracking-widest text-chalk-400 font-bold">
            Score officiel de {{ quiz.candidateName }}
          </span>
          <h2 class="text-4xl sm:text-5xl font-black text-chalk-100 tracking-tight">
            {{ quiz.scoreResult.score }} <span class="text-2xl text-chalk-400">/ 20</span>
          </h2>
        </div>

        <div class="max-w-xl mx-auto space-y-2 pt-2">
          <p class="text-lg font-bold text-ball">{{ quiz.verdict.title }}</p>
          <p class="text-sm sm:text-base text-chalk-400 leading-relaxed">
            {{ quiz.verdict.message }}
          </p>
        </div>

        <div class="pt-4 flex flex-wrap justify-center gap-3">
          <button
            v-if="quiz.currentAttemptPublicId"
            id="share-quiz-btn"
            type="button"
            class="rounded-xl bg-ball px-5 py-2.5 text-sm font-bold text-pitch-950 transition hover:bg-ball/90 shadow-md cursor-pointer flex items-center gap-2"
            @click="copyShareLink"
          >
            <span>{{ copied ? 'Lien copié dans le presse-papier ! ✅' : 'Partager le lien dans le chat HandiBaby 📋' }}</span>
          </button>

          <button
            type="button"
            class="rounded-xl bg-pitch-800 hover:bg-pitch-700 border border-pitch-700 px-5 py-2.5 text-sm font-semibold text-chalk-100 transition cursor-pointer"
            @click="quiz.restartQuiz"
          >
            Recommencer le test 🔄
          </button>
        </div>
      </div>

      <!-- Complete Review of All 20 Questions -->
      <div class="space-y-6">
        <div class="flex items-center justify-between border-b border-pitch-800 pb-3">
          <h3 class="text-lg font-bold text-chalk-100">
            Correction intégrale des 20 questions
          </h3>
          <span class="text-xs text-chalk-400">
            Vert = Bonne réponse attendue | Rouge = Erreur ou oubli
          </span>
        </div>

        <div
          v-for="(q, idx) in QUIZ_QUESTIONS"
          :key="q.id"
          class="rounded-2xl border p-6 sm:p-7 space-y-5 transition"
          :class="
            quiz.scoreResult.evaluations[q.id]?.isFullyCorrect
              ? 'border-emerald-500/50 bg-emerald-950/20'
              : quiz.scoreResult.evaluations[q.id]?.isIncomplete
                ? 'border-amber-500/50 bg-amber-950/20'
                : 'border-rose-500/40 bg-rose-950/20'
          "
        >
          <!-- Question Header & Status Badge -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-pitch-800/80 pb-3">
            <div class="flex items-center gap-2">
              <span class="font-bold text-base text-chalk-100">Question {{ idx + 1 }}</span>
              <span class="text-xs text-chalk-400 font-mono">Guide FFFT p. {{ q.page }}</span>
            </div>

            <!-- Detailed Status Badge -->
            <div
              class="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border"
              :class="
                quiz.scoreResult.evaluations[q.id]?.isFullyCorrect
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : quiz.scoreResult.evaluations[q.id]?.isIncomplete
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              "
            >
              <span v-if="quiz.scoreResult.evaluations[q.id]?.isFullyCorrect">
                ✅ Exact (+1 pt)
              </span>
              <span v-else-if="quiz.scoreResult.evaluations[q.id]?.isIncomplete">
                ⚠️ Faux (0 pt) — Choix incomplet ({{ q.correctAnswers.length }} réponses requises)
              </span>
              <span v-else-if="quiz.scoreResult.evaluations[q.id]?.isUnanswered">
                ⚪ Non répondu (0 pt)
              </span>
              <span v-else>
                ❌ Faux (0 pt)
              </span>
            </div>
          </div>

          <p class="text-base sm:text-lg font-semibold text-chalk-100 leading-snug">
            {{ q.question }}
          </p>

          <!-- Options with precise coloring -->
          <div class="space-y-2.5">
            <div
              v-for="opt in q.options"
              :key="opt.id"
              class="rounded-xl p-3.5 border flex items-start justify-between gap-3 text-sm transition"
              :class="
                q.correctAnswers.includes(opt.id) &&
                quiz.answers[q.id]?.includes(opt.id)
                  ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100'
                  : q.correctAnswers.includes(opt.id) &&
                    !quiz.answers[q.id]?.includes(opt.id)
                    ? 'border-emerald-500/40 bg-pitch-950/60 text-emerald-300'
                    : !q.correctAnswers.includes(opt.id) &&
                      quiz.answers[q.id]?.includes(opt.id)
                      ? 'border-rose-500/70 bg-rose-950/50 text-rose-200'
                      : 'border-pitch-800 bg-pitch-950/40 text-chalk-400/70'
              "
            >
              <div class="flex items-start gap-3">
                <span class="mt-0.5 text-base shrink-0">
                  <span v-if="quiz.answers[q.id]?.includes(opt.id)">
                    {{ q.correctAnswers.includes(opt.id) ? '☑️' : '❌' }}
                  </span>
                  <span v-else>
                    {{ q.correctAnswers.includes(opt.id) ? '⚠️' : '▫️' }}
                  </span>
                </span>
                <span class="leading-snug">{{ opt.label }}</span>
              </div>

              <!-- Tag explanation -->
              <div class="shrink-0 text-xs font-semibold">
                <span
                  v-if="
                    q.correctAnswers.includes(opt.id) &&
                    quiz.answers[q.id]?.includes(opt.id)
                  "
                  class="text-emerald-400"
                >
                  Bonne réponse cochée
                </span>
                <span
                  v-else-if="
                    q.correctAnswers.includes(opt.id) &&
                    !quiz.answers[q.id]?.includes(opt.id)
                  "
                  class="text-emerald-400/90"
                >
                  Bonne réponse oubliée
                </span>
                <span
                  v-else-if="
                    !q.correctAnswers.includes(opt.id) &&
                    quiz.answers[q.id]?.includes(opt.id)
                  "
                  class="text-rose-400"
                >
                  Mauvaise sélection
                </span>
              </div>
            </div>
          </div>

          <!-- Official Guide Reference Box -->
          <div class="rounded-xl border border-pitch-800 bg-pitch-950/90 p-4 text-xs sm:text-sm space-y-1">
            <h4 class="font-bold text-ball flex items-center gap-1.5">
              <span>📖</span> Explication officielle FFFT (Page {{ q.page }}) :
            </h4>
            <p class="text-chalk-400 leading-relaxed">
              {{ q.explanation }}
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
