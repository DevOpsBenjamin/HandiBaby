<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { db, syncEngine } from '@/core/container'
import { displayName } from '@/features/players/domain/naming'
import type { Player } from '@/features/players/domain/types'
import MatchRow from '../components/MatchRow.vue'
import UnlockPanel from '../components/UnlockPanel.vue'
import { JournalReader, type JournalRecord } from '../JournalReader'
import { ScheduleReader, type MatchView, type ScheduleProgress } from '../ScheduleReader'
import { ScoreKeeper } from '../ScoreKeeper'
import { TeamRepository } from '../TeamRepository'
import { useTournamentsStore } from '../stores/tournaments'
import type { MatchResult } from '../domain/score'
import { MAXIMUM_TEAM_NAME_LENGTH } from '../domain/teamNames'
import type { Team, Tournament } from '../domain/types'

const props = defineProps<{ publicId: string }>()

const reader = new ScheduleReader(db)
const journal = new JournalReader(db)
const scores = new ScoreKeeper(db, syncEngine)
const teamRepository = new TeamRepository(db)
const tournaments = useTournamentsStore()

const tournament = ref<Tournament | null>(null)
const matches = ref<MatchView[]>([])
const history = ref<Map<number, JournalRecord[]>>(new Map())
const roster = ref<Player[]>([])
const progress = ref<ScheduleProgress | null>(null)
const teams = ref<Team[]>([])
const loaded = ref(false)
const unlocked = ref(false)
const error = ref<string | null>(null)
const saving = ref<number | null>(null)
const correcting = ref<number | null>(null)
const renaming = ref(false)
const nameDrafts = ref<Record<number, string>>({})
const nameError = ref<string | null>(null)

const isDraft = computed(() => tournament.value?.status === 'draft')
const isRoundRobin = computed(() => tournament.value?.status === 'round-robin')
const isPlayoff = computed(() => ['playoff', 'finished'].includes(tournament.value?.status ?? ''))

const remaining = computed(() => matches.value.filter((match) => !match.played))

onMounted(async () => {
  tournament.value = (await tournaments.find(props.publicId)) ?? null
  unlocked.value = tournaments.isUnlocked(props.publicId)

  const id = tournament.value?.id
  if (id !== undefined && !isDraft.value) {
    roster.value = await reader.roster(id)
    teams.value = await teamRepository.list(id)

    for (const team of teams.value) {
      nameDrafts.value[team.id ?? 0] = team.label
    }

    await refresh(id)
  }

  loaded.value = true
})

async function refresh(tournamentId: number): Promise<void> {
  matches.value = await reader.listMatches(tournamentId)
  progress.value = await reader.progress(tournamentId)
  history.value = await journal.forMatches(matches.value.map((match) => match.id))
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

/** A team is recognised by who is in it, never by the name being replaced. */
function playersOf(team: Team): string {
  return [team.playerOneId, team.playerTwoId]
    .map((playerId) => roster.value.find((player) => (player.id ?? 0) === playerId))
    .map((player) => (player === undefined ? '—' : displayName(player, roster.value)))
    .join(' et ')
}

async function rename(teamId: number): Promise<void> {
  const id = tournament.value?.id

  if (id === undefined) {
    return
  }

  nameError.value = null

  try {
    const stored = await teamRepository.rename(id, teamId, nameDrafts.value[teamId] ?? '')
    nameDrafts.value[teamId] = stored
    teams.value = await teamRepository.list(id)
    await refresh(id)
  } catch (caught) {
    nameError.value = caught instanceof Error ? caught.message : String(caught)
  }
}
</script>

<template>
  <section class="space-y-8">
    <RouterLink
      :to="{ name: 'tournament-list' }"
      class="text-sm text-chalk-400 hover:text-chalk-100"
    >
      ← Toutes les éditions
    </RouterLink>

    <p v-if="loaded && tournament === null" class="text-chalk-400">
      Cette édition est introuvable sur cet appareil.
    </p>

    <template v-else-if="tournament">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">{{ tournament.label }}</h2>
        <p class="mt-1 text-chalk-400">
          Débutée le {{ tournament.startDate }}
          <template v-if="progress">
            · {{ progress.playedMatches }} match{{ progress.playedMatches > 1 ? 's' : '' }} sur
            {{ progress.totalMatches }} joué{{ progress.playedMatches > 1 ? 's' : '' }}
          </template>
        </p>
      </div>

      <RouterLink
        v-if="isDraft"
        :to="{ name: 'tournament-participants', params: { publicId } }"
        class="inline-block rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950"
      >
        Joueurs de l’édition
      </RouterLink>

      <template v-else>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            v-if="isPlayoff"
            :to="{ name: 'playoff', params: { publicId } }"
            class="inline-block rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950"
          >
            Playoff
          </RouterLink>

          <RouterLink
            :to="{ name: 'standings', params: { publicId } }"
            class="inline-block rounded-lg border border-pitch-700 px-4 py-2 text-sm hover:border-ball"
          >
            Classement et configurations
          </RouterLink>
        </div>

        <div v-if="teams.length > 0" class="space-y-3">
          <div class="flex flex-wrap items-baseline gap-3">
            <h3 class="mr-auto text-sm font-medium tracking-wide text-chalk-400 uppercase">
              Équipes
            </h3>
            <button
              type="button"
              class="text-sm text-chalk-400 hover:text-chalk-100"
              @click="renaming = !renaming"
            >
              {{ renaming ? 'Terminer' : 'Renommer' }}
            </button>
          </div>

          <UnlockPanel
            v-if="renaming && !unlocked"
            :tournament="tournament"
            @unlocked="unlocked = true"
          />

          <p
            v-if="nameError"
            role="alert"
            class="rounded-xl bg-rose-950/60 px-5 py-4 text-sm text-rose-200"
          >
            {{ nameError }}
          </p>

          <ul class="divide-y divide-pitch-800 overflow-hidden rounded-xl bg-pitch-900">
            <li
              v-for="team in teams"
              :key="team.id"
              class="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3"
            >
              <div class="min-w-48 flex-1">
                <input
                  v-if="renaming && unlocked"
                  v-model="nameDrafts[team.id ?? 0]"
                  type="text"
                  :maxlength="MAXIMUM_TEAM_NAME_LENGTH"
                  :placeholder="team.label"
                  class="w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-1.5 text-sm text-chalk-100 outline-none focus:border-ball"
                  @keyup.enter="rename(team.id ?? 0)"
                />
                <span v-else class="font-medium">{{ team.label }}</span>

                <p class="mt-1 text-xs text-chalk-400">{{ playersOf(team) }}</p>
              </div>

              <button
                v-if="renaming && unlocked"
                type="button"
                class="rounded-lg border border-pitch-700 px-3 py-1.5 text-sm text-chalk-400 hover:border-ball hover:text-chalk-100"
                @click="rename(team.id ?? 0)"
              >
                Enregistrer
              </button>
            </li>
          </ul>
        </div>

        <div v-if="isRoundRobin" class="space-y-3">
          <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">
            Matchs de classement
          </h3>
          <p class="text-sm text-chalk-400">
            Jouez-les dans l’ordre qui vous arrange : ceux qui sont à la table prennent le prochain
            match qui leur va. Les postes et les côtés sont déjà décidés, le vainqueur est toujours
            à dix.
          </p>

          <UnlockPanel
            v-if="!unlocked && !renaming"
            :tournament="tournament"
            @unlocked="unlocked = true"
          />

          <p
            v-if="error"
            role="alert"
            class="rounded-xl bg-rose-950/60 px-5 py-4 text-sm text-rose-200"
          >
            {{ error }}
          </p>
        </div>

        <ol v-if="matches.length > 0" class="space-y-3">
          <MatchRow
            v-for="match in matches"
            :key="match.id"
            :match="match"
            :roster="roster"
            :unlocked="unlocked && isRoundRobin"
            :busy="saving === match.id"
            :correcting="correcting === match.id"
            :records="history.get(match.id) ?? []"
            @submit="write(match.id, $event)"
            @correct="correcting = match.id"
            @cancel="correcting = null"
          />
        </ol>

        <div v-if="progress && remaining.length === 0 && isRoundRobin" class="space-y-3">
          <p class="text-emerald-300">Tous les matchs de classement sont saisis.</p>
          <RouterLink
            :to="{ name: 'validation', params: { publicId } }"
            class="inline-block rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950"
          >
            Clôturer la phase de classement
          </RouterLink>
        </div>
      </template>
    </template>
  </section>
</template>
