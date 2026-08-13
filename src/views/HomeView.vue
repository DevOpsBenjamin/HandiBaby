<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTournamentsStore } from '@/features/tournaments/stores/tournaments'

/**
 * Pure dispatcher. When a single edition is running, walking past the table and
 * opening the link should land on it, not on a list of one. The list stays
 * reachable at its own route, so leaving an edition never bounces straight back
 * into it.
 */
const router = useRouter()
const tournaments = useTournamentsStore()

onMounted(async () => {
  await tournaments.load()

  const sole = tournaments.soleInProgress
  await router.replace(
    sole === null
      ? { name: 'tournament-list' }
      : { name: 'tournament', params: { publicId: sole.publicId } },
  )
})
</script>

<template>
  <p class="text-chalk-400">Chargement…</p>
</template>
