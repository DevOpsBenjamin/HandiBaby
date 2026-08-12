<script setup lang="ts">
import { computed } from 'vue'
import { useSyncStore } from '@/stores/sync'
import type { SyncPhase } from '@/core/sync/types'

const sync = useSyncStore()

const DOT_CLASSES: Record<SyncPhase, string> = {
  idle: 'bg-emerald-400',
  syncing: 'bg-sky-400 animate-pulse',
  offline: 'bg-chalk-400',
  error: 'bg-rose-500',
  disabled: 'bg-pitch-700',
}

const dotClass = computed(() =>
  sync.phase === 'idle' && sync.hasPendingWrites ? 'bg-ball' : DOT_CLASSES[sync.phase],
)
</script>

<template>
  <div class="flex items-center gap-3">
    <span
      class="flex items-center gap-2 rounded-full bg-pitch-800 px-3 py-1.5 text-sm font-medium"
      :title="sync.lastError ?? undefined"
    >
      <span class="size-2 rounded-full" :class="dotClass" aria-hidden="true" />
      {{ sync.label }}
      <span v-if="sync.hasPendingWrites" class="text-chalk-400">
        ({{ sync.pendingOperations }})
      </span>
    </span>

    <button
      v-if="sync.isSupabaseConfigured"
      type="button"
      class="rounded-full border border-pitch-700 px-3 py-1.5 text-sm text-chalk-400 transition hover:border-pitch-700 hover:text-chalk-100 disabled:opacity-40"
      :disabled="sync.isSyncing"
      @click="sync.syncNow()"
    >
      Synchroniser
    </button>
  </div>
</template>
