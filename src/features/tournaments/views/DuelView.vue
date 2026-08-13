<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { db, syncEngine } from '@/core/container'
import { displayName } from '@/features/players/domain/naming'
import type { Player } from '@/features/players/domain/types'
import MatchHistory from '../components/MatchHistory.vue'
import MatchScoreEntry from '../components/MatchScoreEntry.vue'
import UnlockPanel from '../components/UnlockPanel.vue'
import { JournalReader, type JournalRecord } from '../JournalReader'
import { ScheduleReader, type DuelDetail, type MatchSide } from '../ScheduleReader'
import { ScoreKeeper } from '../ScoreKeeper'
import { useTournamentsStore } from '../stores/tournaments'
import { WINNING_SCORE, type MatchResult } from '../domain/score'
import type { TableSide, Tournament } from '../domain/types'

const props = defineProps<{ publicId: string; duel: string }>()

const reader = new ScheduleReader(db)
const journal = new JournalReader(db)
const scores = new ScoreKeeper(db, syncEngine)
const tournaments = useTournamentsStore()

const tournament = ref<Tournament | null>(null)
const detail = ref<DuelDetail | null>(null)
const history = ref<Map<number, JournalRecord[]>>(new Map())
const roster = ref<Player[]>([])
const loaded = ref(false)
const unlocked = ref(false)
const error = ref<string | null>(null)
/** Id of the match being written, so only its own pad greys out. */
const saving = ref<number | null>(null)
/** Id of the match whose result is being replaced, if any. */
const correcting = ref<number | null>(null)

const title = computed(() =>
  detail.value === null
    ? ''
    : detail.value.teams.map((team) => team.players.map(name).join(' et ')).join('  vs  '),
)

onMounted(async () => {
  tournament.value = (await tournaments.find(props.publicId)) ?? null
  unlocked.value = tournaments.isUnlocked(props.publicId)

  const id = tournament.value?.id
  if (id !== undefined) {
    roster.value = await reader.roster(id)
    await refresh(id)
  }

  loaded.value = true
})

async function refresh(tournamentId: number): Promise<void> {
  detail.value = await reader.readDuel(tournamentId, Number(props.duel))
  history.value = await journal.forMatches((detail.value?.matches ?? []).map((match) => match.id))
}

async function write(matchId: number, result: MatchResult): Promise<void> {
  const edition = tournament.value

  if (edition === null || edition.id === undefined) {
    return
  }

  const replacing = correcting.value === matchId
  error.value = null
  saving.value = matchId

  try {
    await (replacing
      ? scores.correct(edition, matchId, result)
      : scores.record(edition, matchId, result))
    correcting.value = null
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    saving.value = null
    // Re-read either way: a refusal means the stored result is not what was displayed.
    await refresh(edition.id)
  }
}

function currentResult(match: DuelDetail['matches'][number]): MatchResult | null {
  if (match.winnerTeamId === null || match.loserScore === null) {
    return null
  }

  return {
    winningSide: match.winnerTeamId === match.blue.teamId ? 'blue' : 'white',
    loserScore: match.loserScore,
  }
}

function name(player: Player | null): string {
  return player === null ? '—' : displayName(player, roster.value)
}

function sideName(side: MatchSide): string {
  return `${name(side.defender)} / ${name(side.attacker)}`
}

function outcome(match: DuelDetail['matches'][number]): string {
  if (!match.played) {
    return 'À jouer'
  }

  const winner = match.winnerTeamId === match.blue.teamId ? match.blue : match.white
  return `${winner.teamLabel} ${WINNING_SCORE} – ${match.loserScore}`
}

/**
 * A played match reads as a result, not as a disabled row: the winning side is
 * marked rather than the whole card dimmed. Unplayed keeps the table colours,
 * which are what people match against the actual baby-foot.
 */
function sideClass(match: DuelDetail['matches'][number], side: TableSide): string {
  const teamId = side === 'blue' ? match.blue.teamId : match.white.teamId

  if (!match.played) {
    return side === 'blue' ? 'border-sky-500/40 bg-sky-950/30' : 'border-pitch-700 bg-pitch-800/60'
  }

  return match.winnerTeamId === teamId
    ? 'border-emerald-500/60 bg-emerald-950/40'
    : 'border-pitch-800 bg-pitch-900/40 text-chalk-400'
}
</script>

<template>
  <section v-if="loaded && detail === null" class="text-chalk-400">
    Ce duel est introuvable.
  </section>

  <section v-else-if="detail" class="space-y-8">
    <div>
      <RouterLink
        :to="{ name: 'tournament', params: { publicId } }"
        class="text-sm text-chalk-400 hover:text-chalk-100"
      >
        ← {{ tournament?.label }}
      </RouterLink>

      <h2 class="mt-2 text-2xl font-semibold tracking-tight">Duel {{ detail.duel }}</h2>
      <p class="mt-1 text-chalk-400">{{ title }}</p>
    </div>

    <p class="text-sm text-chalk-400">
      Les quatre matchs se jouent d’affilée. Les postes et les côtés sont déjà décidés : personne
      n’a à en discuter à la table. Le vainqueur est toujours à dix.
    </p>

    <UnlockPanel
      v-if="tournament && !unlocked"
      :tournament="tournament"
      @unlocked="unlocked = true"
    />

    <p v-if="error" role="alert" class="rounded-xl bg-rose-950/60 px-5 py-4 text-sm text-rose-200">
      {{ error }}
    </p>

    <ol class="space-y-3">
      <li v-for="match in detail.matches" :key="match.id" class="rounded-xl bg-pitch-900 px-5 py-4">
        <div class="flex items-baseline justify-between gap-4">
          <span class="text-sm text-chalk-400">Match {{ match.rankInDuel }}</span>
          <span class="text-sm" :class="match.played ? 'text-emerald-300' : 'text-ball'">
            {{ outcome(match) }}
          </span>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border px-4 py-3" :class="sideClass(match, 'blue')">
            <p class="text-xs tracking-wide text-sky-300 uppercase">Bleu</p>
            <p class="mt-1 font-medium">{{ sideName(match.blue) }}</p>
            <p class="text-xs text-chalk-400">{{ match.blue.teamLabel }}, défense / attaque</p>
          </div>

          <div class="rounded-lg border px-4 py-3" :class="sideClass(match, 'white')">
            <p class="text-xs tracking-wide text-chalk-400 uppercase">Blanc</p>
            <p class="mt-1 font-medium">{{ sideName(match.white) }}</p>
            <p class="text-xs text-chalk-400">{{ match.white.teamLabel }}, défense / attaque</p>
          </div>
        </div>

        <MatchScoreEntry
          v-if="unlocked && (!match.played || correcting === match.id)"
          :busy="saving === match.id"
          :current="correcting === match.id ? currentResult(match) : null"
          @submit="write(match.id, $event)"
          @cancel="correcting = null"
        />

        <div v-else-if="unlocked && match.played" class="mt-3 flex flex-wrap items-center gap-3">
          <p class="text-sm text-chalk-400">
            Résultat actuel :
            <span class="text-chalk-100">{{ outcome(match) }}</span>
          </p>

          <button
            type="button"
            class="rounded-lg border border-pitch-700 px-3 py-1.5 text-sm text-chalk-400 hover:border-ball hover:text-chalk-100"
            @click="correcting = match.id"
          >
            Corriger
          </button>
        </div>

        <MatchHistory
          v-if="(history.get(match.id) ?? []).length > 0"
          :records="history.get(match.id) ?? []"
        />
      </li>
    </ol>

    <p class="text-sm text-chalk-400">
      Un score reste corrigeable tant que la phase de classement n’a pas été validée. Chaque saisie
      et chaque correction laissent une trace dans l’historique du match.
    </p>
  </section>
</template>
