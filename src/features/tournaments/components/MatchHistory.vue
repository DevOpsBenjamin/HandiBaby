<script setup lang="ts">
import type { JournalRecord } from '../JournalReader'
import { WINNING_SCORE, type MatchResult } from '../domain/score'
import { SIDE_LABELS } from '../domain/types'

defineProps<{ records: readonly JournalRecord[] }>()

const WHEN = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

function score(result: MatchResult): string {
  return `${SIDE_LABELS[result.winningSide]} ${WINNING_SCORE} – ${result.loserScore}`
}

function line(record: JournalRecord): string {
  return record.previous === null
    ? `Saisi ${score(record.next)}`
    : `Corrigé ${score(record.previous)} en ${score(record.next)}`
}
</script>

<template>
  <details class="mt-3 border-t border-pitch-800 pt-3">
    <summary class="cursor-pointer text-xs tracking-wide text-chalk-400 uppercase">
      Historique ({{ records.length }})
    </summary>

    <ol class="mt-2 space-y-1">
      <li v-for="record in records" :key="record.entryId" class="text-xs text-chalk-400">
        {{ line(record) }} · {{ WHEN.format(record.writtenAt) }}
      </li>
    </ol>

    <p class="mt-2 text-xs text-chalk-400">
      L’historique ne dit pas qui a saisi : sans compte, un nom déclaré ressemblerait à une preuve
      sans en être une.
    </p>
  </details>
</template>
