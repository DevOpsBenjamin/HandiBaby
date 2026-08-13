<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { db } from '@/core/container'
import type { Player } from '@/features/players/domain/types'
import DuelList from '../components/DuelList.vue'
import { ScheduleReader, type DuelSummary, type ScheduleProgress } from '../ScheduleReader'
import { useTournamentsStore } from '../stores/tournaments'
import type { Tournament } from '../domain/types'

const props = defineProps<{ publicId: string }>()

const reader = new ScheduleReader(db)
const tournaments = useTournamentsStore()

const tournament = ref<Tournament | null>(null)
const duels = ref<DuelSummary[]>([])
const roster = ref<Player[]>([])
const progress = ref<ScheduleProgress | null>(null)
const loaded = ref(false)

const isDraft = computed(() => tournament.value?.status === 'draft')
const remaining = computed(() => duels.value.filter((duel) => !duel.complete))
const played = computed(() => duels.value.filter((duel) => duel.complete))

onMounted(async () => {
  tournament.value = (await tournaments.find(props.publicId)) ?? null

  const id = tournament.value?.id
  if (id !== undefined && !isDraft.value) {
    ;[duels.value, roster.value, progress.value] = await Promise.all([
      reader.listDuels(id),
      reader.roster(id),
      reader.progress(id),
    ])
  }

  loaded.value = true
})
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

        <div v-if="played.length > 0" class="space-y-3">
          <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">
            Joués ({{ played.length }})
          </h3>
          <DuelList :public-id="publicId" :duels="played" :roster="roster" />
        </div>

        <p v-if="progress && remaining.length === 0" class="text-emerald-300">
          Tous les matchs de classement sont saisis.
        </p>
      </template>
    </template>
  </section>
</template>
