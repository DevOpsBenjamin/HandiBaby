<script setup lang="ts">
import { computed, ref } from 'vue'
import { LOSER_SCORES, WINNING_SCORE, type MatchResult } from '../domain/score'
import { SIDE_LABELS, type TableSide } from '../domain/types'

/** `current` is set when correcting: what is about to be replaced, shown first. */
const props = defineProps<{
  busy: boolean
  current?: MatchResult | null
  blueTeamLabel?: string
  whiteTeamLabel?: string
}>()
const emit = defineEmits<{ submit: [MatchResult]; cancel: [] }>()

/** Held between the two taps: the winning side, then where the loser stopped. */
const winningSide = ref<TableSide | null>(null)

function teamLabelOf(side: TableSide): string {
  if (side === 'blue') {
    return props.blueTeamLabel || SIDE_LABELS.blue
  }
  return props.whiteTeamLabel || SIDE_LABELS.white
}

const winningTeamLabel = computed(() => {
  if (winningSide.value === null) {
    return ''
  }
  return teamLabelOf(winningSide.value)
})

function choose(side: TableSide): void {
  winningSide.value = side
}

function submit(loserScore: number): void {
  const side = winningSide.value

  if (side === null) {
    return
  }

  winningSide.value = null
  emit('submit', { winningSide: side, loserScore })
}
</script>

<template>
  <div class="mt-3 border-t border-pitch-800 pt-3">
    <p v-if="current" class="mb-2 text-xs text-chalk-400">
      Résultat actuel :
      <span class="text-chalk-100">
        {{ teamLabelOf(current.winningSide) }} {{ WINNING_SCORE }} – {{ current.loserScore }}
      </span>
    </p>

    <template v-if="winningSide === null">
      <p class="text-xs tracking-wide text-chalk-400 uppercase">
        {{ current ? 'Qui gagne en fait ?' : 'Qui gagne ?' }}
      </p>

      <div class="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-2 text-sm hover:border-sky-400 disabled:opacity-40"
          :disabled="busy"
          @click="choose('blue')"
        >
          {{ teamLabelOf('blue') }} gagne
        </button>
        <button
          type="button"
          class="rounded-lg border border-pitch-700 bg-pitch-800/60 px-4 py-2 text-sm hover:border-chalk-400 disabled:opacity-40"
          :disabled="busy"
          @click="choose('white')"
        >
          {{ teamLabelOf('white') }} gagne
        </button>

        <button
          v-if="current"
          type="button"
          class="rounded-lg px-3 py-2 text-sm text-chalk-400 hover:text-chalk-100 disabled:opacity-40"
          :disabled="busy"
          @click="emit('cancel')"
        >
          Annuler
        </button>
      </div>
    </template>

    <template v-else>
      <p class="text-xs tracking-wide text-chalk-400 uppercase">
        {{ winningTeamLabel }} gagne {{ WINNING_SCORE }} à combien ?
      </p>

      <div class="mt-2 flex flex-wrap items-center gap-2">
        <button
          v-for="score in LOSER_SCORES"
          :key="score"
          type="button"
          class="size-10 rounded-lg border border-pitch-700 text-sm hover:border-ball disabled:opacity-40"
          :disabled="busy"
          @click="submit(score)"
        >
          {{ score }}
        </button>

        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm text-chalk-400 hover:text-chalk-100 disabled:opacity-40"
          :disabled="busy"
          @click="winningSide = null"
        >
          Changer
        </button>
      </div>
    </template>
  </div>
</template>
