<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePlayerPoolStore } from '../stores/pool'
import { displayName } from '../domain/naming'

const pool = usePlayerPoolStore()

const firstName = ref('')
const lastName = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

const canSubmit = computed(
  () => firstName.value.trim() !== '' && lastName.value.trim() !== '' && !submitting.value,
)

onMounted(() => pool.load())

async function submit(): Promise<void> {
  error.value = null
  submitting.value = true

  try {
    await pool.add(firstName.value, lastName.value)
    firstName.value = ''
    lastName.value = ''
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="space-y-8">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight">Vivier de joueurs</h2>
      <p class="mt-1 text-chalk-400">
        Le vivier est permanent. Chaque édition y pioche les présents, et c’est ce qui permet de
        suivre un joueur d’une édition à l’autre.
      </p>
    </div>

    <form class="flex flex-wrap items-end gap-3" @submit.prevent="submit">
      <label class="flex-1 basis-40 text-sm">
        <span class="text-chalk-400">Prénom</span>
        <input
          v-model="firstName"
          type="text"
          autocomplete="off"
          class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
        />
      </label>

      <label class="flex-1 basis-40 text-sm">
        <span class="text-chalk-400">Nom</span>
        <input
          v-model="lastName"
          type="text"
          autocomplete="off"
          class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
        />
      </label>

      <button
        type="submit"
        class="rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950 disabled:opacity-40"
        :disabled="!canSubmit"
      >
        Ajouter
      </button>
    </form>

    <p v-if="error" role="alert" class="rounded-xl bg-rose-950/60 px-5 py-4 text-sm text-rose-200">
      {{ error }}
    </p>

    <p v-if="pool.isEmpty" class="text-chalk-400">Aucun joueur pour l’instant.</p>

    <ul v-else class="divide-y divide-pitch-800 overflow-hidden rounded-xl bg-pitch-900">
      <li
        v-for="player in pool.players"
        :key="player.nameKey"
        class="flex items-baseline justify-between px-5 py-3"
      >
        <span class="font-medium">{{ player.firstName }} {{ player.lastName }}</span>
        <span class="text-sm text-chalk-400">{{ displayName(player, pool.players) }}</span>
      </li>
    </ul>
  </section>
</template>
