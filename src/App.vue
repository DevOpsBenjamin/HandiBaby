<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSyncStore } from '@/stores/syncStore'
import { syncService } from '@/services/syncService'
import { db, type Player, type Team, type Match } from '@/services/db'
import {
  Wifi,
  WifiOff,
  Database,
  Cloud,
  CloudOff,
  RefreshCw,
  PlusCircle,
  Trash2,
  TrendingUp,
  Check,
  Smartphone,
  ChevronRight,
  Sparkles,
  Users,
  Trophy
} from 'lucide-vue-next'

const syncStore = useSyncStore()

// Mock data generation inputs
const inputPlayerName = ref('')
const inputTeamName = ref('')
const selectedPlayer1 = ref('')
const selectedPlayer2 = ref('')

const inputMatchTeam1 = ref('')
const inputMatchTeam2 = ref('')
const inputScore1 = ref(0)
const inputScore2 = ref(0)

// Local Reactive state from IndexedDB
const localPlayers = ref<Player[]>([])
const localTeams = ref<Team[]>([])
const localMatches = ref<Match[]>([])

const refreshLocalData = async () => {
  localPlayers.value = await db.players.toArray()
  localTeams.value = await db.teams.toArray()
  localMatches.value = await db.matches.toArray()
}

onMounted(async () => {
  await refreshLocalData()
})

// Business actions
const addPlayer = async () => {
  if (!inputPlayerName.value.trim()) return
  const id = crypto.randomUUID()
  const payload: Player = {
    id,
    name: inputPlayerName.value.trim(),
    createdAt: Date.now()
  }

  // Insert to local IndexedDB
  await db.players.add(payload)

  // Queue for Supabase sync
  await syncService.queueChange('players', 'INSERT', id, payload)

  inputPlayerName.value = ''
  await refreshLocalData()
}

const deletePlayer = async (id: string) => {
  await db.players.delete(id)
  await syncService.queueChange('players', 'DELETE', id, {})
  await refreshLocalData()
}

const addTeam = async () => {
  if (!inputTeamName.value.trim() || !selectedPlayer1.value || !selectedPlayer2.value) return
  const id = crypto.randomUUID()
  const payload: Team = {
    id,
    name: inputTeamName.value.trim(),
    player1Id: selectedPlayer1.value,
    player2Id: selectedPlayer2.value,
    createdAt: Date.now()
  }

  await db.teams.add(payload)
  await syncService.queueChange('teams', 'INSERT', id, payload)

  inputTeamName.value = ''
  selectedPlayer1.value = ''
  selectedPlayer2.value = ''
  await refreshLocalData()
}

const deleteTeam = async (id: string) => {
  await db.teams.delete(id)
  await syncService.queueChange('teams', 'DELETE', id, {})
  await refreshLocalData()
}

const addMatch = async () => {
  if (!inputMatchTeam1.value || !inputMatchTeam2.value) return
  const id = crypto.randomUUID()
  const payload: Match = {
    id,
    team1Id: inputMatchTeam1.value,
    team2Id: inputMatchTeam2.value,
    score1: inputScore1.value,
    score2: inputScore2.value,
    playedAt: Date.now()
  }

  await db.matches.add(payload)
  await syncService.queueChange('matches', 'INSERT', id, payload)

  inputMatchTeam1.value = ''
  inputMatchTeam2.value = ''
  inputScore1.value = 0
  inputScore2.value = 0
  await refreshLocalData()
}

const deleteMatch = async (id: string) => {
  await db.matches.delete(id)
  await syncService.queueChange('matches', 'DELETE', id, {})
  await refreshLocalData()
}

// Sync buttons
const handleSyncPush = async () => {
  await syncService.sync()
}

const handleSyncPull = async () => {
  const ok = await syncService.pullLatestData()
  if (ok) {
    await refreshLocalData()
  }
}

const clearLocalDatabase = async () => {
  if (confirm('Voulez-vous vraiment vider TOUTES les données locales d\'IndexedDB ?')) {
    await db.players.clear()
    await db.teams.clear()
    await db.matches.clear()
    await db.syncQueue.clear()
    await syncStore.updateQueueLength()
    await refreshLocalData()
    syncStore.addLog('info', 'La base de données locale a été réinitialisée.')
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white pb-16">
    <!-- Top Elegant Navigation / Banner -->
    <header class="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-500/30">
            <Trophy class="w-6 h-6" />
          </div>
          <div>
            <h1 class="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              HandiBaby <span class="text-xs bg-indigo-500/20 text-indigo-400 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-500/30">Socle V1</span>
            </h1>
            <p class="text-[10px] text-slate-400">Offline-first &bullet; TypeScript &bullet; Supabase</p>
          </div>
        </div>

        <!-- Dynamic Connection Badges -->
        <div class="flex items-center gap-2 sm:gap-3 text-xs">
          <!-- Network Connection Status -->
          <span
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all duration-300"
            :class="syncStore.isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'"
          >
            <component :is="syncStore.isOnline ? Wifi : WifiOff" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ syncStore.isOnline ? 'En ligne' : 'Hors ligne' }}</span>
          </span>

          <!-- Supabase Client Status -->
          <span
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium"
            :class="syncStore.isSupabaseReady ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'"
          >
            <component :is="syncStore.isSupabaseReady ? Cloud : CloudOff" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ syncStore.isSupabaseReady ? 'Supabase Connecté' : 'Supabase Inactif' }}</span>
          </span>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

      <!-- LEFT SECTION: Control & Synchronization Board -->
      <section class="lg:col-span-4 space-y-6">
        <!-- Synchronization Panel -->
        <div class="bg-slate-950/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <Database class="w-4 h-4 text-indigo-400" /> Gestionnaire PWA & Sync
            </h3>
            <span v-if="syncStore.queueLength > 0" class="flex h-2 w-2 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          </div>

          <!-- Network sync status card -->
          <div class="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 mb-6 space-y-3">
            <div class="flex justify-between items-center text-sm text-slate-400">
              <span>Modifications en attente :</span>
              <span class="font-mono font-bold text-lg" :class="syncStore.queueLength > 0 ? 'text-amber-400' : 'text-slate-300'">
                {{ syncStore.queueLength }}
              </span>
            </div>
            <div class="flex justify-between items-center text-xs text-slate-500">
              <span>Dernière synchronisation :</span>
              <span class="font-mono">{{ syncStore.lastSyncedAt ? new Date(syncStore.lastSyncedAt).toLocaleTimeString() : 'Jamais' }}</span>
            </div>
          </div>

          <!-- Sync Trigger Buttons -->
          <div class="grid grid-cols-2 gap-3 mb-4">
            <button
              @click="handleSyncPush"
              :disabled="syncStore.isSyncing || !syncStore.isOnline"
              class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-xs text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 transition-colors shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': syncStore.isSyncing }" />
              Pousser
            </button>
            <button
              @click="handleSyncPull"
              :disabled="syncStore.isSyncing || !syncStore.isOnline"
              class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 disabled:bg-slate-800 disabled:text-slate-500 border border-slate-700/50 transition-colors cursor-pointer"
            >
              <Cloud class="w-3.5 h-3.5" />
              Importer
            </button>
          </div>

          <button
            @click="clearLocalDatabase"
            class="w-full text-center py-2 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors bg-rose-500/5 hover:bg-rose-500/10 rounded-lg border border-rose-500/10 cursor-pointer"
          >
            Vider IndexedDB (Local)
          </button>
        </div>

        <!-- Sync Logs console -->
        <div class="bg-slate-950/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl flex flex-col h-64">
          <h3 class="text-sm font-semibold tracking-wider text-slate-300 uppercase mb-3 flex items-center gap-2">
            Console de Logs
          </h3>
          <div class="flex-1 overflow-y-auto font-mono text-[11px] bg-slate-950 p-3 rounded-lg border border-slate-900 space-y-1.5 scrollbar-thin">
            <div v-if="syncStore.syncLogs.length === 0" class="text-slate-600 italic">
              Aucun événement enregistré.
            </div>
            <div
              v-for="(log, idx) in syncStore.syncLogs"
              :key="idx"
              :class="{
                'text-indigo-400': log.type === 'info',
                'text-emerald-400': log.type === 'success',
                'text-rose-400': log.type === 'error'
              }"
            >
              <span class="text-slate-600">[{{ log.time }}]</span> {{ log.message }}
            </div>
          </div>
        </div>
      </section>

      <!-- RIGHT SECTION: Test IndexedDB operations and Live Store status -->
      <section class="lg:col-span-8 space-y-8">

        <!-- Quick Informative Setup Banner -->
        <div class="relative bg-gradient-to-r from-indigo-900/40 via-indigo-950/40 to-indigo-900/40 border border-indigo-500/20 rounded-2xl p-6 overflow-hidden">
          <div class="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div class="space-y-1">
              <h2 class="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles class="w-5 h-5 text-amber-400" /> Socle Technique Opérationnel
              </h2>
              <p class="text-slate-300 text-xs max-w-xl leading-relaxed">
                Le socle prend en charge le stockage local permanent dans IndexedDB via Dexie.js et planifie automatiquement les synchronisations vers Supabase. Les composants ci-dessous vous permettent de tester l'intégrité du système de queues et des tables.
              </p>
            </div>
            <div class="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-xl self-start sm:self-center">
              PWA Activée
            </div>
          </div>
        </div>

        <!-- Grid to interact with IndexedDB Entities -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

          <!-- Players Manager -->
          <div class="bg-slate-950/30 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 class="text-sm font-semibold tracking-wider text-slate-200 uppercase flex items-center gap-2">
                <Users class="w-4 h-4 text-indigo-400" /> Joueurs (IndexedDB)
              </h3>
              <span class="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                {{ localPlayers.length }}
              </span>
            </div>

            <!-- Form -->
            <div class="flex gap-2">
              <input
                v-model="inputPlayerName"
                type="text"
                placeholder="Nom du joueur..."
                @keyup.enter="addPlayer"
                class="flex-1 bg-slate-900 text-xs text-white placeholder-slate-500 px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500"
              />
              <button
                @click="addPlayer"
                class="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl p-2 transition-colors cursor-pointer"
              >
                <PlusCircle class="w-4 h-4" />
              </button>
            </div>

            <!-- List -->
            <ul class="space-y-2 max-h-48 overflow-y-auto">
              <li
                v-for="p in localPlayers"
                :key="p.id"
                class="flex justify-between items-center text-xs bg-slate-900/40 border border-slate-800/50 hover:border-slate-800 rounded-xl px-3 py-2"
              >
                <span class="text-slate-300 font-medium">{{ p.name }}</span>
                <button
                  @click="deletePlayer(p.id)"
                  class="text-rose-500 hover:text-rose-400 p-1 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </li>
              <li v-if="localPlayers.length === 0" class="text-xs text-slate-500 italic text-center py-4">
                Aucun joueur enregistré localement.
              </li>
            </ul>
          </div>

          <!-- Teams Manager -->
          <div class="bg-slate-950/30 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 class="text-sm font-semibold tracking-wider text-slate-200 uppercase flex items-center gap-2">
                <Users class="w-4 h-4 text-emerald-400" /> Équipes (IndexedDB)
              </h3>
              <span class="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                {{ localTeams.length }}
              </span>
            </div>

            <!-- Form -->
            <div class="space-y-2.5">
              <input
                v-model="inputTeamName"
                type="text"
                placeholder="Nom de l'équipe (ex. Les Pros)"
                class="w-full bg-slate-900 text-xs text-white placeholder-slate-500 px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500"
              />
              <div class="grid grid-cols-2 gap-2">
                <select
                  v-model="selectedPlayer1"
                  class="bg-slate-900 text-xs text-white px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="" disabled selected>Joueur 1</option>
                  <option v-for="p in localPlayers" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <select
                  v-model="selectedPlayer2"
                  class="bg-slate-900 text-xs text-white px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="" disabled selected>Joueur 2</option>
                  <option v-for="p in localPlayers" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>
              <button
                @click="addTeam"
                class="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PlusCircle class="w-3.5 h-3.5" /> Créer l'Équipe
              </button>
            </div>

            <!-- List -->
            <ul class="space-y-2 max-h-48 overflow-y-auto">
              <li
                v-for="t in localTeams"
                :key="t.id"
                class="flex justify-between items-center text-xs bg-slate-900/40 border border-slate-800/50 hover:border-slate-800 rounded-xl px-3 py-2"
              >
                <div>
                  <span class="text-slate-300 font-semibold block">{{ t.name }}</span>
                  <span class="text-[10px] text-slate-500 block">
                    {{ localPlayers.find(p => p.id === t.player1Id)?.name || '?' }} &amp; {{ localPlayers.find(p => p.id === t.player2Id)?.name || '?' }}
                  </span>
                </div>
                <button
                  @click="deleteTeam(t.id)"
                  class="text-rose-500 hover:text-rose-400 p-1 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </li>
              <li v-if="localTeams.length === 0" class="text-xs text-slate-500 italic text-center py-4">
                Aucune équipe enregistrée localement.
              </li>
            </ul>
          </div>

        </div>

        <!-- Matches Tracker -->
        <div class="bg-slate-950/30 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 class="text-sm font-semibold tracking-wider text-slate-200 uppercase flex items-center gap-2">
              <TrendingUp class="w-4 h-4 text-amber-400" /> Matchs &amp; Scores (IndexedDB)
            </h3>
            <span class="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
              {{ localMatches.length }}
            </span>
          </div>

          <!-- Add Match Form -->
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div class="sm:col-span-4 space-y-1.5">
              <label class="text-[10px] text-slate-400 uppercase font-semibold">Équipe 1</label>
              <select
                v-model="inputMatchTeam1"
                class="w-full bg-slate-900 text-xs text-white px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="" disabled selected>Choisir Équipe 1</option>
                <option v-for="t in localTeams" :key="t.id" :value="t.id" :disabled="t.id === inputMatchTeam2">{{ t.name }}</option>
              </select>
            </div>

            <div class="sm:col-span-2 space-y-1.5">
              <label class="text-[10px] text-slate-400 uppercase font-semibold">Score 1</label>
              <input
                v-model.number="inputScore1"
                type="number"
                min="0"
                class="w-full bg-slate-900 text-xs text-white text-center px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="sm:col-span-2 space-y-1.5">
              <label class="text-[10px] text-slate-400 uppercase font-semibold">Score 2</label>
              <input
                v-model.number="inputScore2"
                type="number"
                min="0"
                class="w-full bg-slate-900 text-xs text-white text-center px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="sm:col-span-4 space-y-1.5">
              <label class="text-[10px] text-slate-400 uppercase font-semibold">Équipe 2</label>
              <select
                v-model="inputMatchTeam2"
                class="w-full bg-slate-900 text-xs text-white px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="" disabled selected>Choisir Équipe 2</option>
                <option v-for="t in localTeams" :key="t.id" :value="t.id" :disabled="t.id === inputMatchTeam1">{{ t.name }}</option>
              </select>
            </div>

            <div class="sm:col-span-12">
              <button
                @click="addMatch"
                class="w-full bg-amber-600 hover:bg-amber-500 text-white rounded-xl py-2 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check class="w-3.5 h-3.5" /> Enregistrer le Match
              </button>
            </div>
          </div>

          <!-- Match history -->
          <div class="space-y-2 max-h-60 overflow-y-auto">
            <div
              v-for="m in localMatches"
              :key="m.id"
              class="flex items-center justify-between text-xs bg-slate-900/40 border border-slate-800/50 hover:border-slate-800 rounded-xl px-4 py-3"
            >
              <div class="flex items-center gap-4 flex-1">
                <span class="text-slate-300 font-semibold text-right flex-1 truncate">
                  {{ localTeams.find(t => t.id === m.team1Id)?.name || 'Équipe Supprimée' }}
                </span>
                <span class="font-mono text-sm px-2.5 py-1 rounded-lg bg-slate-950 font-bold text-amber-400 shrink-0">
                  {{ m.score1 }} - {{ m.score2 }}
                </span>
                <span class="text-slate-300 font-semibold text-left flex-1 truncate">
                  {{ localTeams.find(t => t.id === m.team2Id)?.name || 'Équipe Supprimée' }}
                </span>
              </div>

              <button
                @click="deleteMatch(m.id)"
                class="text-rose-500 hover:text-rose-400 p-1 hover:bg-rose-500/10 rounded-lg transition-colors ml-4 cursor-pointer"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
            <div v-if="localMatches.length === 0" class="text-xs text-slate-500 italic text-center py-6">
              Aucune rencontre enregistrée localement.
            </div>
          </div>
        </div>

      </section>

    </main>
  </div>
</template>

<style>
/* Custom styled minimal scrollbar */
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 9999px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
