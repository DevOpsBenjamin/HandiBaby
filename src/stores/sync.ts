import { computed, onScopeDispose, ref } from 'vue'
import { defineStore } from 'pinia'
import { gateway, syncEngine } from '@/core/container'
import type { SyncSnapshot } from '@/core/sync/types'

/** Reactive facade over the SyncEngine. Components read this, never the engine. */
export const useSyncStore = defineStore('sync', () => {
  const snapshot = ref<SyncSnapshot>(syncEngine.snapshot)

  const unsubscribe = syncEngine.subscribe((next) => {
    snapshot.value = next
  })
  onScopeDispose(unsubscribe)

  const phase = computed(() => snapshot.value.phase)
  const pendingOperations = computed(() => snapshot.value.pendingOperations)
  const lastError = computed(() => snapshot.value.lastError)
  const lastSuccessAt = computed(() => snapshot.value.lastSuccessAt)

  const isSupabaseConfigured = computed(() => gateway.isConfigured)
  const isSyncing = computed(() => phase.value === 'syncing')
  const hasPendingWrites = computed(() => pendingOperations.value > 0)

  const label = computed(() => {
    switch (phase.value) {
      case 'disabled':
        return 'Local uniquement'
      case 'offline':
        return 'Hors ligne'
      case 'syncing':
        return 'Synchronisation…'
      case 'error':
        return 'Échec de synchronisation'
      case 'idle':
        return hasPendingWrites.value ? 'En attente d’envoi' : 'À jour'
    }
  })

  function start(): void {
    syncEngine.start()
  }

  function stop(): void {
    syncEngine.stop()
  }

  async function syncNow(): Promise<void> {
    await syncEngine.sync()
  }

  return {
    snapshot,
    phase,
    label,
    pendingOperations,
    hasPendingWrites,
    lastError,
    lastSuccessAt,
    isSupabaseConfigured,
    isSyncing,
    start,
    stop,
    syncNow,
  }
})
