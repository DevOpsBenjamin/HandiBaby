import { db, type LocalSyncQueue } from './db'
import { supabase, isSupabaseConfigured } from './supabase'
import { useSyncStore } from '@/stores/syncStore'

export class SyncService {
  private static instance: SyncService | null = null

  private constructor() {}

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService()
    }
    return SyncService.instance
  }

  /**
   * Add a transaction/action to the sync queue.
   */
  public async queueChange(
    table: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string,
    payload: any
  ): Promise<void> {
    const store = useSyncStore()

    // Check if we already have a pending queue item for this record to optimize
    const existing = await db.syncQueue
      .where('recordId')
      .equals(recordId)
      .first()

    if (existing && existing.table === table) {
      if (action === 'DELETE') {
        // If we are deleting, just delete any previous insertions/updates
        await db.syncQueue.delete(existing.id!)
        await db.syncQueue.add({
          table,
          action,
          recordId,
          payload: {},
          timestamp: Date.now()
        })
      } else {
        // Update the payload of the existing queue item
        await db.syncQueue.update(existing.id!, {
          payload,
          timestamp: Date.now()
        })
      }
    } else {
      await db.syncQueue.add({
        table,
        action,
        recordId,
        payload,
        timestamp: Date.now()
      })
    }

    await store.updateQueueLength()
    store.addLog('info', `Action ${action} sur ${table} mise en file d'attente (ID local: ${recordId})`)

    // Attempt auto-sync if online
    if (store.isOnline && isSupabaseConfigured) {
      this.sync().catch(err => console.error('Auto sync failed:', err))
    }
  }

  /**
   * Main synchronization worker.
   * Processes the queue sequentially to maintain chronological integrity.
   */
  public async sync(): Promise<boolean> {
    const store = useSyncStore()
    if (store.isSyncing) return false
    if (!store.isOnline) {
      store.addLog('error', 'Synchronisation impossible : l\'appareil est hors ligne.')
      return false
    }
    if (!isSupabaseConfigured || !supabase) {
      store.addLog('error', 'Supabase non configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.')
      return false
    }

    store.setSyncing(true)
    store.addLog('info', 'Début de la synchronisation avec Supabase...')

    try {
      // Get all queued actions sorted by id/timestamp
      const queueItems = await db.syncQueue.orderBy('id').toArray()

      if (queueItems.length === 0) {
        store.addLog('success', 'Aucune modification locale à synchroniser.')
        store.lastSyncedAt = Date.now()
        store.setSyncing(false)
        return true
      }

      for (const item of queueItems) {
        const success = await this.syncItem(item)
        if (success) {
          await db.syncQueue.delete(item.id!)
          await store.updateQueueLength()
        } else {
          // Break cycle if one fails to keep ordering intact (e.g., dependency error)
          store.addLog('error', `Échec de synchro sur la table ${item.table} (ID: ${item.recordId}). Synchro interrompue.`)
          store.setSyncing(false)
          return false
        }
      }

      store.addLog('success', `Synchronisation réussie ! ${queueItems.length} modification(s) poussée(s).`)
      store.lastSyncedAt = Date.now()
      store.setSyncing(false)
      return true
    } catch (error: any) {
      store.addLog('error', `Erreur de synchronisation globale : ${error?.message || error}`)
      store.setSyncing(false)
      return false
    }
  }

  /**
   * Synchronize a single queue item to Supabase.
   */
  private async syncItem(item: LocalSyncQueue): Promise<boolean> {
    if (!supabase) return false

    try {
      const { table, action, recordId, payload } = item

      if (action === 'INSERT' || action === 'UPDATE') {
        // Upsert handles both INSERT and UPDATE naturally on Supabase if the primary key matches
        const { error } = await supabase
          .from(table)
          .upsert({ ...payload, id: recordId })

        if (error) {
          console.error('Supabase Upsert Error:', error)
          return false
        }
      } else if (action === 'DELETE') {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', recordId)

        if (error) {
          console.error('Supabase Delete Error:', error)
          return false
        }
      }
      return true
    } catch (err) {
      console.error('Failed to sync queue item:', err)
      return false
    }
  }

  /**
   * Pull latest data from Supabase to initialize/update IndexedDB.
   */
  public async pullLatestData(): Promise<boolean> {
    const store = useSyncStore()
    if (!store.isOnline || !supabase) {
      store.addLog('error', 'Impossible de récupérer les données : hors ligne ou Supabase non configuré.')
      return false
    }

    store.setSyncing(true)
    store.addLog('info', 'Importation des données depuis Supabase...')

    try {
      // 1. Players
      const { data: remotePlayers, error: playersErr } = await supabase.from('players').select('*')
      if (playersErr) throw playersErr
      if (remotePlayers) {
        await db.players.bulkPut(remotePlayers)
      }

      // 2. Teams
      const { data: remoteTeams, error: teamsErr } = await supabase.from('teams').select('*')
      if (teamsErr) throw teamsErr
      if (remoteTeams) {
        await db.teams.bulkPut(remoteTeams)
      }

      // 3. Matches
      const { data: remoteMatches, error: matchesErr } = await supabase.from('matches').select('*')
      if (matchesErr) throw matchesErr
      if (remoteMatches) {
        await db.matches.bulkPut(remoteMatches)
      }

      store.addLog('success', 'Importation des données Supabase réussie !')
      store.setSyncing(false)
      return true
    } catch (error: any) {
      store.addLog('error', `Échec de l'importation : ${error?.message || error}`)
      store.setSyncing(false)
      return false
    }
  }
}

export const syncService = SyncService.getInstance()
export default syncService
