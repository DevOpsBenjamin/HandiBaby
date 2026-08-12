import { defineStore } from 'pinia'
import { ref, onMounted, onUnmounted } from 'vue'
import { isSupabaseConfigured } from '@/services/supabase'
import { db } from '@/services/db'

export const useSyncStore = defineStore('sync', () => {
  const isOnline = ref(navigator.onLine)
  const isSupabaseReady = ref(isSupabaseConfigured)
  const isSyncing = ref(false)
  const lastSyncedAt = ref<number | null>(null)
  const queueLength = ref(0)
  const syncLogs = ref<Array<{ time: string; type: 'info' | 'success' | 'error'; message: string }>>([])

  // Utility to add structured log messages
  const addLog = (type: 'info' | 'success' | 'error', message: string) => {
    const time = new Date().toLocaleTimeString()
    syncLogs.value.unshift({ time, type, message })
    if (syncLogs.value.length > 50) {
      syncLogs.value.pop()
    }
  }

  // Update online status
  const updateOnlineStatus = () => {
    isOnline.value = navigator.onLine
    addLog('info', `Statut réseau modifié : ${navigator.onLine ? 'En ligne' : 'Hors ligne'}`)
  }

  // Update sync queue length
  const updateQueueLength = async () => {
    queueLength.value = await db.syncQueue.count()
  }

  // Set syncing status
  const setSyncing = (status: boolean) => {
    isSyncing.value = status
  }

  // Register network listeners
  onMounted(async () => {
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    await updateQueueLength()
    addLog('info', 'Système d\'initialisation du socle complété.')
  })

  onUnmounted(() => {
    window.removeEventListener('online', updateOnlineStatus)
    window.removeEventListener('offline', updateOnlineStatus)
  })

  return {
    isOnline,
    isSupabaseReady,
    isSyncing,
    lastSyncedAt,
    queueLength,
    syncLogs,
    addLog,
    updateQueueLength,
    setSyncing
  }
})
