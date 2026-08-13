<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { db, syncEngine } from '@/core/container'
import { displayName } from '@/features/players/domain/naming'
import type { Player } from '@/features/players/domain/types'
import MatchScoreEntry from '../components/MatchScoreEntry.vue'
import UnlockPanel from '../components/UnlockPanel.vue'
import { ScheduleReader, type DuelDetail, type MatchSide } from '../ScheduleReader'
import { ScoreEntry } from '../ScoreEntry'
import { useTournamentsStore } from '../stores/tournaments'
import { WINNING_SCORE, type MatchResult } from '../domain/score'
import type { Tournament } from '../domain/types'

const props = defineProps<{ publicId: string; duel: string }>()

const reader = new ScheduleReader(db)
const entry = new ScoreEntry(db, syncEngine)
const tournaments = useTournamentsStore()

const tournament = ref<Tournament | null>(null)
const detail = ref<DuelDetail | null>(null)
const roster = ref<Player[]>([])
const loaded = ref(false)
const unlocked = ref(false)
const error = ref<string | null>(null)
/** Id of the match being written, so only its own pad greys out. */
const saving = ref<number | null>(null)

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
    detail.value = await reader.readDuel(id, Number(props.duel))
  }

  loaded.value = true
})

async function record(matchId: number, result: MatchResult): Promise<void> {
  const edition = tournament.value

  if (edition === null || edition.id === undefined) {
    return
  }

  error.value = null
  saving.value = matchId

  try {
    await entry.record(edition, matchId, result)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    saving.value = null
    // Re-read either way: a refusal means the stored result is not what was displayed.
    detail.value = await reader.readDuel(edition.id, Number(props.duel))
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
      <li
        v-for="match in detail.matches"
        :key="match.id"
        class="rounded-xl bg-pitch-900 px-5 py-4"
        :class="match.played ? 'opacity-70' : ''"
      >
        <div class="flex items-baseline justify-between gap-4">
          <span class="text-sm text-chalk-400">Match {{ match.rankInDuel }}</span>
          <span class="text-sm" :class="match.played ? 'text-chalk-400' : 'text-ball'">
            {{ outcome(match) }}
          </span>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-3">
            <p class="text-xs tracking-wide text-sky-300 uppercase">Bleu</p>
            <p class="mt-1 font-medium">{{ sideName(match.blue) }}</p>
            <p class="text-xs text-chalk-400">{{ match.blue.teamLabel }}, défense / attaque</p>
          </div>

          <div class="rounded-lg border border-pitch-700 bg-pitch-800/60 px-4 py-3">
            <p class="text-xs tracking-wide text-chalk-400 uppercase">Blanc</p>
            <p class="mt-1 font-medium">{{ sideName(match.white) }}</p>
            <p class="text-xs text-chalk-400">{{ match.white.teamLabel }}, défense / attaque</p>
          </div>
        </div>

        <MatchScoreEntry
          v-if="unlocked && !match.played"
          :busy="saving === match.id"
          @submit="record(match.id, $event)"
        />
      </li>
    </ol>

    <p class="text-sm text-chalk-400">
      Un score déjà saisi ne peut pas encore être repris : la correction arrive dans la prochaine
      livraison.
    </p>
  </section>
</template>
