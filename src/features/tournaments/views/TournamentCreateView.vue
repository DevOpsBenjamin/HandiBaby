<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTournamentsStore } from '../stores/tournaments'
import {
  MINIMUM_PASSPHRASE_LENGTH,
  isStrongEnough,
  normalisePassphrase,
} from '../domain/passphrase'

const router = useRouter()
const tournaments = useTournamentsStore()

const today = new Date().toISOString().slice(0, 10)

const label = ref('')
const startDate = ref(today)
const passphrase = ref('')
const confirmation = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

const strongEnough = computed(() => isStrongEnough(passphrase.value))
const matches = computed(
  () => normalisePassphrase(passphrase.value) === normalisePassphrase(confirmation.value),
)
const canSubmit = computed(
  () => label.value.trim() !== '' && strongEnough.value && matches.value && !submitting.value,
)

async function submit(): Promise<void> {
  error.value = null
  submitting.value = true

  try {
    const created = await tournaments.createDraft({
      label: label.value,
      startDate: startDate.value,
      passphrase: passphrase.value,
    })
    await router.replace({ name: 'tournament', params: { publicId: created.publicId } })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="max-w-lg space-y-8">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight">Nouvelle édition</h2>
      <p class="mt-1 text-chalk-400">
        L’édition est créée vide. Les joueurs et les équipes viennent ensuite, et le calendrier
        n’est engendré qu’à la fin.
      </p>
    </div>

    <form class="space-y-5" @submit.prevent="submit">
      <label class="block text-sm">
        <span class="text-chalk-400">Libellé</span>
        <input
          v-model="label"
          type="text"
          placeholder="Tournoi de printemps"
          class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
        />
      </label>

      <label class="block text-sm">
        <span class="text-chalk-400">Date de début</span>
        <input
          v-model="startDate"
          type="date"
          class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
        />
      </label>

      <div class="space-y-2 rounded-xl border border-pitch-800 p-4">
        <p class="text-sm text-chalk-400">
          La phrase de passe autorise la saisie des scores. Elle se partage avec ceux qui vont
          saisir, et elle ne peut pas être récupérée si elle est perdue.
        </p>

        <label class="block text-sm">
          <span class="text-chalk-400">Phrase de passe</span>
          <input
            v-model="passphrase"
            type="password"
            autocomplete="new-password"
            class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
          />
        </label>

        <label class="block text-sm">
          <span class="text-chalk-400">Confirmation</span>
          <input
            v-model="confirmation"
            type="password"
            autocomplete="new-password"
            class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
          />
        </label>

        <p v-if="passphrase !== '' && !strongEnough" class="text-sm text-ball">
          Au moins {{ MINIMUM_PASSPHRASE_LENGTH }} caractères.
        </p>
        <p v-else-if="confirmation !== '' && !matches" class="text-sm text-ball">
          Les deux phrases ne correspondent pas.
        </p>
      </div>

      <button
        type="submit"
        class="rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950 disabled:opacity-40"
        :disabled="!canSubmit"
      >
        {{ submitting ? 'Création…' : 'Créer l’édition' }}
      </button>
    </form>

    <p v-if="error" role="alert" class="rounded-xl bg-rose-950/60 px-5 py-4 text-sm text-rose-200">
      {{ error }}
    </p>
  </section>
</template>
