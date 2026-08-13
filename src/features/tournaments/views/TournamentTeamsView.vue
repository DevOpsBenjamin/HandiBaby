<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { db } from '@/core/container'
import { displayName } from '@/features/players/domain/naming'
import type { Player } from '@/features/players/domain/types'
import { ParticipantRepository } from '../ParticipantRepository'
import { TournamentSetup } from '../TournamentSetup'
import { useTournamentsStore } from '../stores/tournaments'
import { buildTeams, drawTeams, isSupportedPlayerCount } from '../domain/draw'
import type { Tournament } from '../domain/types'

const props = defineProps<{ publicId: string }>()

const router = useRouter()
const participants = new ParticipantRepository(db)
const setup = new TournamentSetup(db)
const tournaments = useTournamentsStore()

const tournament = ref<Tournament | null>(null)
const roster = ref<Player[]>([])
/** One slot per seat, two consecutive slots make a team. */
const seats = ref<(number | null)[]>([])
const error = ref<string | null>(null)
const loaded = ref(false)
const submitting = ref(false)

const teamCount = computed(() => roster.value.length / 2)
const rosterIsUsable = computed(() => isSupportedPlayerCount(roster.value.length))
const complete = computed(
  () => seats.value.length > 0 && seats.value.every((seat) => seat !== null),
)

onMounted(async () => {
  tournament.value = (await tournaments.find(props.publicId)) ?? null

  const id = tournament.value?.id
  roster.value = id === undefined ? [] : await participants.list(id)
  seats.value = Array.from({ length: roster.value.length }, () => null)
  loaded.value = true
})

function nameOf(playerId: number | null): string {
  const player = roster.value.find((candidate) => candidate.id === playerId)
  return player === undefined ? '' : displayName(player, roster.value)
}

/** A seat may pick anyone not already seated elsewhere. */
function optionsFor(index: number): Player[] {
  const taken = new Set(seats.value.filter((seat, other) => seat !== null && other !== index))
  return roster.value.filter((player) => player.id !== undefined && !taken.has(player.id))
}

function draw(): void {
  error.value = null
  const ids = roster.value.map((player) => player.id).filter((id): id is number => id !== undefined)
  seats.value = drawTeams(ids).flatMap((team) => [...team.players])
}

function clear(): void {
  error.value = null
  seats.value = seats.value.map(() => null)
}

async function confirm(): Promise<void> {
  const id = tournament.value?.id

  if (id === undefined || !complete.value) {
    return
  }

  error.value = null
  submitting.value = true

  try {
    const pairs: (readonly [number, number])[] = []
    for (let index = 0; index < seats.value.length; index += 2) {
      pairs.push([seats.value[index] ?? 0, seats.value[index + 1] ?? 0])
    }

    await setup.start(id, buildTeams(pairs))
    await router.replace({ name: 'tournament', params: { publicId: props.publicId } })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    submitting.value = false
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
        :to="{ name: 'tournament-participants', params: { publicId } }"
        class="text-sm text-chalk-400 hover:text-chalk-100"
      >
        ← Joueurs de l’édition
      </RouterLink>

      <h2 class="mt-2 text-2xl font-semibold tracking-tight">Composition des équipes</h2>
      <p class="mt-1 text-chalk-400">
        À la main ou au tirage, autant de fois que voulu. Rien n’est écrit avant la validation, et
        c’est elle qui engendre le calendrier complet.
      </p>
    </div>

    <p v-if="!rosterIsUsable" class="rounded-xl bg-pitch-900 px-5 py-4 text-sm text-chalk-400">
      Il faut d’abord 6 ou 8 joueurs inscrits.
    </p>

    <template v-else>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg border border-pitch-700 px-4 py-2 text-sm hover:border-ball"
          @click="draw"
        >
          Tirer au sort
        </button>
        <button
          type="button"
          class="rounded-lg px-4 py-2 text-sm text-chalk-400 hover:text-chalk-100"
          @click="clear"
        >
          Effacer
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div
          v-for="team in teamCount"
          :key="team"
          class="space-y-3 rounded-xl border border-pitch-800 p-4"
        >
          <h3 class="font-medium">Équipe {{ team }}</h3>

          <label v-for="seat in 2" :key="seat" class="block text-sm">
            <span class="text-chalk-400">Joueur {{ seat }}</span>
            <select
              v-model="seats[(team - 1) * 2 + (seat - 1)]"
              class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
            >
              <option :value="null">—</option>
              <option
                v-for="player in optionsFor((team - 1) * 2 + (seat - 1))"
                :key="player.nameKey"
                :value="player.id"
              >
                {{ displayName(player, roster) }}
              </option>
            </select>
          </label>

          <p class="text-xs text-chalk-400">
            L’ordre ne veut rien dire : qui défend et qui attaque se décide match par match.
          </p>
        </div>
      </div>

      <p
        v-if="error"
        role="alert"
        class="rounded-xl bg-rose-950/60 px-5 py-4 text-sm text-rose-200"
      >
        {{ error }}
      </p>

      <div class="flex flex-wrap items-center gap-4">
        <button
          type="button"
          class="rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950 disabled:opacity-40"
          :disabled="!complete || submitting"
          @click="confirm"
        >
          {{ submitting ? 'Génération…' : 'Valider et engendrer le calendrier' }}
        </button>

        <p class="text-sm text-chalk-400">
          {{ teamCount }} équipes, donc {{ (teamCount * (teamCount - 1)) / 2 }} duels et
          {{ teamCount * (teamCount - 1) * 2 }} matchs. Le calendrier ne pourra plus être régénéré.
        </p>
      </div>

      <p v-if="complete" class="text-sm text-chalk-400">
        <span v-for="team in teamCount" :key="team" class="mr-4 inline-block">
          Équipe {{ team }} : {{ nameOf(seats[(team - 1) * 2] ?? null) }} et
          {{ nameOf(seats[(team - 1) * 2 + 1] ?? null) }}
        </span>
      </p>
    </template>
  </section>
</template>
