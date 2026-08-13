<script setup lang="ts">
import { ref } from 'vue'
import { useTournamentsStore } from '../stores/tournaments'
import type { Tournament } from '../domain/types'

const props = defineProps<{ tournament: Tournament }>()
const emit = defineEmits<{ unlocked: [] }>()

const tournaments = useTournamentsStore()

const passphrase = ref('')
const checking = ref(false)
const refused = ref(false)

async function submit(): Promise<void> {
  checking.value = true
  refused.value = false

  try {
    const accepted = await tournaments.unlock(props.tournament, passphrase.value)

    if (accepted) {
      passphrase.value = ''
      emit('unlocked')
    } else {
      refused.value = true
    }
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <form class="space-y-3 rounded-xl bg-pitch-900 px-5 py-4" @submit.prevent="submit">
    <h3 class="font-medium">Saisie verrouillée</h3>

    <p class="text-sm text-chalk-400">
      Il faut la phrase de passe de l’édition pour saisir un score. Elle est vérifiée sur
      l’appareil, donc sans réseau, puis retenue ici pour cette édition.
    </p>

    <label class="block text-sm">
      <span class="text-chalk-400">Phrase de passe</span>
      <input
        v-model="passphrase"
        type="password"
        autocomplete="current-password"
        class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
      />
    </label>

    <p
      v-if="refused"
      role="alert"
      class="rounded-lg bg-rose-950/60 px-4 py-3 text-sm text-rose-200"
    >
      Phrase de passe refusée.
    </p>

    <button
      type="submit"
      class="rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950 disabled:opacity-40"
      :disabled="checking || passphrase.trim() === ''"
    >
      {{ checking ? 'Vérification…' : 'Déverrouiller la saisie' }}
    </button>
  </form>
</template>
