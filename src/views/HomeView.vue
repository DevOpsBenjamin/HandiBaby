<script setup lang="ts">
import { useConnectivityStore } from '@/stores/connectivity'
import { useSyncStore } from '@/stores/sync'

const connectivity = useConnectivityStore()
const sync = useSyncStore()

function formatTimestamp(value: number | null): string {
  return value === null ? 'jamais' : new Date(value).toLocaleTimeString('fr-FR')
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight">Socle technique</h2>
      <p class="mt-1 text-chalk-400">
        Les écrans du tournoi seront ajoutés fonctionnalité par fonctionnalité.
      </p>
    </div>

    <dl class="grid gap-px overflow-hidden rounded-xl bg-pitch-800 sm:grid-cols-2">
      <div class="bg-pitch-900 px-5 py-4">
        <dt class="text-sm text-chalk-400">Réseau</dt>
        <dd class="mt-1 font-medium">{{ connectivity.isOnline ? 'En ligne' : 'Hors ligne' }}</dd>
      </div>

      <div class="bg-pitch-900 px-5 py-4">
        <dt class="text-sm text-chalk-400">Supabase</dt>
        <dd class="mt-1 font-medium">
          {{ sync.isSupabaseConfigured ? 'Configuré' : 'Non configuré' }}
        </dd>
      </div>

      <div class="bg-pitch-900 px-5 py-4">
        <dt class="text-sm text-chalk-400">Écritures en attente</dt>
        <dd class="mt-1 font-medium">{{ sync.pendingOperations }}</dd>
      </div>

      <div class="bg-pitch-900 px-5 py-4">
        <dt class="text-sm text-chalk-400">Dernière synchronisation</dt>
        <dd class="mt-1 font-medium">{{ formatTimestamp(sync.lastSuccessAt) }}</dd>
      </div>
    </dl>

    <p v-if="sync.lastError" class="rounded-xl bg-rose-950/60 px-5 py-4 text-sm text-rose-200">
      {{ sync.lastError }}
    </p>
  </section>
</template>
