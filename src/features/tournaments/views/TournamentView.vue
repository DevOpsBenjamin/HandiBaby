<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useTournamentsStore } from '../stores/tournaments'
import type { Tournament } from '../domain/types'

const props = defineProps<{ publicId: string }>()

const tournaments = useTournamentsStore()

const tournament = ref<Tournament | null>(null)
const loaded = ref(false)

onMounted(async () => {
  tournament.value = (await tournaments.find(props.publicId)) ?? null
  loaded.value = true
})
</script>

<template>
  <section class="space-y-6">
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
        <p class="mt-1 text-chalk-400">Débutée le {{ tournament.startDate }}</p>
      </div>

      <dl class="grid gap-px overflow-hidden rounded-xl bg-pitch-800 sm:grid-cols-2">
        <div class="bg-pitch-900 px-5 py-4">
          <dt class="text-sm text-chalk-400">État</dt>
          <dd class="mt-1 font-medium">{{ tournament.status }}</dd>
        </div>

        <div class="bg-pitch-900 px-5 py-4">
          <dt class="text-sm text-chalk-400">Saisie</dt>
          <dd class="mt-1 font-medium">
            {{ tournaments.isUnlocked(tournament.publicId) ? 'Déverrouillée' : 'Verrouillée' }}
          </dd>
        </div>
      </dl>

      <RouterLink
        v-if="tournament.status === 'draft'"
        :to="{ name: 'tournament-participants', params: { publicId } }"
        class="inline-block rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950"
      >
        Joueurs de l’édition
      </RouterLink>

      <p class="text-chalk-400">
        Les équipes et le calendrier arrivent dans les prochaines livraisons.
      </p>
    </template>
  </section>
</template>
