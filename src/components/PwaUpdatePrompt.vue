<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW()

function dismiss(): void {
  needRefresh.value = false
  offlineReady.value = false
}
</script>

<template>
  <div
    v-if="needRefresh || offlineReady"
    role="status"
    class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-pitch-700 bg-pitch-900 px-4 py-3 shadow-lg"
  >
    <p class="flex-1 text-sm">
      {{ needRefresh ? 'Une nouvelle version est disponible.' : 'Prêt à fonctionner hors ligne.' }}
    </p>

    <button
      v-if="needRefresh"
      type="button"
      class="rounded-lg bg-ball px-3 py-1.5 text-sm font-semibold text-pitch-950"
      @click="updateServiceWorker()"
    >
      Recharger
    </button>

    <button
      type="button"
      class="rounded-lg px-3 py-1.5 text-sm text-chalk-400 hover:text-chalk-100"
      @click="dismiss"
    >
      Fermer
    </button>
  </div>
</template>
