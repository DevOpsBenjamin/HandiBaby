<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { db } from '@/core/container'
import type { Player } from '@/features/players/domain/types'
import DuelList from '../components/DuelList.vue'
import UnlockPanel from '../components/UnlockPanel.vue'
import { TeamRepository } from '../TeamRepository'
import { MAXIMUM_TEAM_NAME_LENGTH } from '../domain/teamNames'
import type { Team } from '../domain/types'
import { ScheduleReader, type DuelSummary, type ScheduleProgress } from '../ScheduleReader'
import { useTournamentsStore } from '../stores/tournaments'
import type { Tournament } from '../domain/types'

const props = defineProps<{ publicId: string }>()

const reader = new ScheduleReader(db)
const teamRepository = new TeamRepository(db)
const tournaments = useTournamentsStore()

const tournament = ref<Tournament | null>(null)
const duels = ref<DuelSummary[]>([])
const roster = ref<Player[]>([])
const progress = ref<ScheduleProgress | null>(null)
const loaded = ref(false)
const teams = ref<Team[]>([])
const renaming = ref(false)
const unlocked = ref(false)
const nameDrafts = ref<Record<number, string>>({})
const nameError = ref<string | null>(null)

const isDraft = computed(() => tournament.value?.status === 'draft')
const isRoundRobin = computed(() => tournament.value?.status === 'round-robin')
const isPlayoff = computed(() => ['playoff', 'finished'].includes(tournament.value?.status ?? ''))
const remaining = computed(() => duels.value.filter((duel) => !duel.complete))
const played = computed(() => duels.value.filter((duel) => duel.complete))

onMounted(async () => {
  tournament.value = (await tournaments.find(props.publicId)) ?? null
  unlocked.value = tournaments.isUnlocked(props.publicId)

  const id = tournament.value?.id
  if (id !== undefined && !isDraft.value) {
    teams.value = await teamRepository.list(id)
    for (const team of teams.value) {
      nameDrafts.value[team.id ?? 0] = team.label
    }

    ;[duels.value, roster.value, progress.value] = await Promise.all([
      reader.listDuels(id),
      reader.roster(id),
      reader.progress(id),
    ])
  }

  loaded.value = true
})

/**
 * Nicknames turn up several duels in, so renaming stays open for the whole life
 * of an edition. Everything downstream keys on the team id, so this only
 * changes what is printed, frozen group phase included.
 */
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
    duels.value = await reader.listDuels(id)
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
            · {{ progress.playedDuels }} duel{{ progress.playedDuels > 1 ? 's' : '' }} sur
            {{ progress.totalDuels }} joué{{ progress.playedDuels > 1 ? 's' : '' }}
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
        <RouterLink
          v-if="isPlayoff"
          :to="{ name: 'playoff', params: { publicId } }"
          class="mr-2 inline-block rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950"
        >
          Playoff
        </RouterLink>

        <RouterLink
          :to="{ name: 'standings', params: { publicId } }"
          class="inline-block rounded-lg border border-pitch-700 px-4 py-2 text-sm hover:border-ball"
        >
          Classement et configurations
        </RouterLink>

        <div v-if="remaining.length > 0" class="space-y-3">
          <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">
            À jouer ({{ remaining.length }})
          </h3>
          <p class="text-sm text-chalk-400">
            Un duel se joue d’un bloc, ses quatre matchs à la suite. Il faut donc que ses quatre
            joueurs soient à la table en même temps.
          </p>
          <DuelList :public-id="publicId" :duels="remaining" :roster="roster" />
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
            v-if="renaming && !unlocked && tournament"
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
              class="flex flex-wrap items-center gap-3 px-5 py-3"
            >
              <template v-if="renaming && unlocked">
                <input
                  v-model="nameDrafts[team.id ?? 0]"
                  type="text"
                  :maxlength="MAXIMUM_TEAM_NAME_LENGTH"
                  class="flex-1 rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-1.5 text-sm text-chalk-100 outline-none focus:border-ball"
                  @keyup.enter="rename(team.id ?? 0)"
                />
                <button
                  type="button"
                  class="rounded-lg border border-pitch-700 px-3 py-1.5 text-sm text-chalk-400 hover:border-ball hover:text-chalk-100"
                  @click="rename(team.id ?? 0)"
                >
                  Enregistrer
                </button>
              </template>

              <span v-else class="font-medium">{{ team.label }}</span>
            </li>
          </ul>
        </div>

        <div v-if="played.length > 0" class="space-y-3">
          <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">
            Joués ({{ played.length }})
          </h3>
          <DuelList :public-id="publicId" :duels="played" :roster="roster" />
        </div>

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
