<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useTournamentsStore } from '../stores/tournaments'

const tournaments = useTournamentsStore()

onMounted(() => tournaments.load())

const STATUS_LABELS = {
  draft: 'En préparation',
  'round-robin': 'Phase de classement',
  playoff: 'Playoff',
  finished: 'Terminée',
  abandoned: 'Abandonnée',
} as const
</script>

<template>
  <section class="space-y-8">
    <div class="flex flex-wrap items-start gap-4">
      <div class="mr-auto">
        <h2 class="text-2xl font-semibold tracking-tight">Éditions</h2>
        <p class="mt-1 text-chalk-400">Les éditions en cours, puis celles qui sont terminées.</p>
      </div>

      <RouterLink
        :to="{ name: 'tournament-create' }"
        class="rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950"
      >
        Nouvelle édition
      </RouterLink>
    </div>

    <p v-if="tournaments.isEmpty" class="text-chalk-400">
      Aucune édition pour l’instant. La première se crée en une minute.
    </p>

    <template v-for="group in ['inProgress', 'finished'] as const" :key="group">
      <div v-if="tournaments[group].length > 0" class="space-y-3">
        <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">
          {{ group === 'inProgress' ? 'En cours' : 'Terminées' }}
        </h3>

        <ul class="divide-y divide-pitch-800 overflow-hidden rounded-xl bg-pitch-900">
          <li v-for="tournament in tournaments[group]" :key="tournament.publicId">
            <RouterLink
              :to="{ name: 'tournament', params: { publicId: tournament.publicId } }"
              class="flex items-baseline justify-between px-5 py-4 hover:bg-pitch-800"
            >
              <span class="font-medium">{{ tournament.label }}</span>
              <span class="text-sm text-chalk-400">{{ STATUS_LABELS[tournament.status] }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
