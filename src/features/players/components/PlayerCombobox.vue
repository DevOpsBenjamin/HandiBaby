<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlayerPoolStore } from '../stores/pool'
import { buildNameKey } from '../domain/naming'
import type { Player } from '../domain/types'

const props = defineProps<{
  /** Players already picked; they stay out of the suggestions. */
  excluded: readonly number[]
}>()

const emit = defineEmits<{ pick: [Player] }>()

const pool = usePlayerPoolStore()

const query = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

/** "Lucas Martin" typed in one go fills both fields; a single word fills the first. */
const parsed = computed(() => {
  const words = query.value.trim().split(/\s+/).filter(Boolean)
  return { firstName: words[0] ?? '', lastName: words.slice(1).join(' ') }
})

const newFirstName = ref('')
const newLastName = ref('')
const creating = ref(false)

const suggestions = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('fr')

  return pool.players
    .filter((player) => player.id !== undefined && !props.excluded.includes(player.id))
    .filter((player) => needle === '' || player.nameKey.includes(needle))
    .slice(0, 8)
})

const alreadyInPool = computed(() =>
  pool.players.some(
    (player) => player.nameKey === buildNameKey(parsed.value.firstName, parsed.value.lastName),
  ),
)

const canOfferCreation = computed(
  () => query.value.trim() !== '' && !alreadyInPool.value && !creating.value,
)

function openCreation(): void {
  newFirstName.value = parsed.value.firstName
  newLastName.value = parsed.value.lastName
  creating.value = true
  error.value = null
}

function cancelCreation(): void {
  creating.value = false
  error.value = null
}

function pick(player: Player): void {
  emit('pick', player)
  query.value = ''
}

async function create(): Promise<void> {
  error.value = null
  busy.value = true

  try {
    const created = await pool.add(newFirstName.value, newLastName.value)
    creating.value = false
    pick(created)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <input
      v-model="query"
      type="search"
      placeholder="Chercher un joueur, ou taper un nouveau nom"
      autocomplete="off"
      class="w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
    />

    <ul v-if="suggestions.length > 0 && !creating" class="space-y-1">
      <li v-for="player in suggestions" :key="player.nameKey">
        <button
          type="button"
          class="w-full rounded-lg px-3 py-2 text-left hover:bg-pitch-800"
          @click="pick(player)"
        >
          {{ player.firstName }} {{ player.lastName }}
        </button>
      </li>
    </ul>

    <button
      v-if="canOfferCreation"
      type="button"
      class="text-sm text-ball hover:underline"
      @click="openCreation"
    >
      Créer « {{ query.trim() }} » dans le vivier
    </button>

    <div v-if="creating" class="space-y-3 rounded-xl border border-pitch-800 p-4">
      <div class="flex flex-wrap gap-3">
        <label class="flex-1 basis-32 text-sm">
          <span class="text-chalk-400">Prénom</span>
          <input
            v-model="newFirstName"
            type="text"
            class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
          />
        </label>

        <label class="flex-1 basis-32 text-sm">
          <span class="text-chalk-400">Nom</span>
          <input
            v-model="newLastName"
            type="text"
            class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
          />
        </label>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg bg-ball px-3 py-1.5 text-sm font-semibold text-pitch-950 disabled:opacity-40"
          :disabled="busy"
          @click="create"
        >
          Créer et ajouter
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-sm text-chalk-400 hover:text-chalk-100"
          @click="cancelCreation"
        >
          Annuler
        </button>
      </div>
    </div>

    <p v-if="error" role="alert" class="text-sm text-rose-300">{{ error }}</p>
  </div>
</template>
