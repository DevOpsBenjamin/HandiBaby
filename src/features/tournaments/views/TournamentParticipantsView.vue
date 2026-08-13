<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { db } from '@/core/container'
import PlayerCombobox from '@/features/players/components/PlayerCombobox.vue'
import { usePlayerPoolStore } from '@/features/players/stores/pool'
import { displayName } from '@/features/players/domain/naming'
import type { Player } from '@/features/players/domain/types'
import { ParticipantRepository } from '../ParticipantRepository'
import { useTournamentsStore } from '../stores/tournaments'
import { SUPPORTED_PLAYER_COUNTS, isSupportedPlayerCount } from '../domain/draw'
import type { Tournament } from '../domain/types'

const props = defineProps<{ publicId: string }>()

const participants = new ParticipantRepository(db)
const tournaments = useTournamentsStore()
const pool = usePlayerPoolStore()

const tournament = ref<Tournament | null>(null)
const roster = ref<Player[]>([])
const error = ref<string | null>(null)
const loaded = ref(false)

const count = computed(() => roster.value.length)
const ready = computed(() => isSupportedPlayerCount(count.value))
const excluded = computed(() =>
  roster.value.map((player) => player.id).filter((id): id is number => id !== undefined),
)

onMounted(async () => {
  await pool.load()
  tournament.value = (await tournaments.find(props.publicId)) ?? null
  await refresh()
  loaded.value = true
})

async function refresh(): Promise<void> {
  const id = tournament.value?.id
  roster.value = id === undefined ? [] : await participants.list(id)
}

async function pick(player: Player): Promise<void> {
  error.value = null
  const id = tournament.value?.id

  if (id === undefined || player.id === undefined) {
    return
  }

  try {
    await participants.add(id, player.id)
    await refresh()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  }
}

async function drop(player: Player): Promise<void> {
  const id = tournament.value?.id

  if (id !== undefined && player.id !== undefined) {
    await participants.remove(id, player.id)
    await refresh()
  }
}
</script>

<template>
  <section v-if="loaded && tournament === null" class="text-chalk-400">
    Cette édition est introuvable sur cet appareil.
  </section>

  <section v-else-if="tournament" class="space-y-8">
    <div>
      <RouterLink
        :to="{ name: 'tournament', params: { publicId } }"
        class="text-sm text-chalk-400 hover:text-chalk-100"
      >
        ← {{ tournament.label }}
      </RouterLink>

      <h2 class="mt-2 text-2xl font-semibold tracking-tight">Joueurs de l’édition</h2>
      <p class="mt-1 text-chalk-400">
        Les présents du jour, piochés dans le vivier. Un nom qui n’y est pas encore se crée ici.
      </p>
    </div>

    <PlayerCombobox :excluded="excluded" @pick="pick" />

    <p v-if="error" role="alert" class="rounded-xl bg-rose-950/60 px-5 py-4 text-sm text-rose-200">
      {{ error }}
    </p>

    <div class="space-y-3">
      <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">
        Inscrits ({{ count }})
      </h3>

      <p v-if="count === 0" class="text-chalk-400">Personne pour l’instant.</p>

      <ul v-else class="divide-y divide-pitch-800 overflow-hidden rounded-xl bg-pitch-900">
        <li
          v-for="player in roster"
          :key="player.nameKey"
          class="flex items-center justify-between px-5 py-3"
        >
          <span class="font-medium">{{ displayName(player, roster) }}</span>
          <button
            type="button"
            class="text-sm text-chalk-400 hover:text-rose-300"
            @click="drop(player)"
          >
            Retirer
          </button>
        </li>
      </ul>
    </div>

    <p
      class="rounded-xl px-5 py-4 text-sm"
      :class="ready ? 'bg-emerald-950/50 text-emerald-200' : 'bg-pitch-900 text-chalk-400'"
    >
      <template v-if="ready">
        {{ count }} joueurs, soit {{ count / 2 }} équipes. La composition des équipes peut
        commencer.
      </template>
      <template v-else>
        Il faut {{ SUPPORTED_PLAYER_COUNTS.join(' ou ') }} joueurs pour lancer une édition, il y en
        a {{ count }}. Le format se joue à trois ou quatre équipes de deux : à sept présents, l’un
        reste sur le banc.
      </template>
    </p>
  </section>
</template>
