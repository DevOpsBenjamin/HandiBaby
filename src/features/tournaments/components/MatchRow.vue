<script setup lang="ts">
import { displayName } from '@/features/players/domain/naming'
import type { Player } from '@/features/players/domain/types'
import MatchHistory from './MatchHistory.vue'
import MatchScoreEntry from './MatchScoreEntry.vue'
import type { JournalRecord } from '../JournalReader'
import type { MatchSide, MatchView } from '../ScheduleReader'
import { WINNING_SCORE, type MatchResult } from '../domain/score'
import type { TableSide } from '../domain/types'

const props = defineProps<{
  match: MatchView
  roster: readonly Player[]
  unlocked: boolean
  busy: boolean
  correcting: boolean
  records: readonly JournalRecord[]
}>()

const emit = defineEmits<{ submit: [MatchResult]; correct: []; cancel: [] }>()

function name(player: Player | null): string {
  return player === null ? '—' : displayName(player, props.roster)
}

function sideName(side: MatchSide): string {
  return `${name(side.defender)} / ${name(side.attacker)}`
}

function outcome(): string {
  if (!props.match.played) {
    return 'À jouer'
  }

  const winner =
    props.match.winnerTeamId === props.match.blue.teamId ? props.match.blue : props.match.white

  return `${winner.teamLabel} ${WINNING_SCORE} – ${props.match.loserScore}`
}

/** A played match reads as a result, not a disabled row: the winner is marked. */
function sideClass(side: TableSide): string {
  const teamId = side === 'blue' ? props.match.blue.teamId : props.match.white.teamId

  if (!props.match.played) {
    return side === 'blue' ? 'border-sky-500/40 bg-sky-950/30' : 'border-pitch-700 bg-pitch-800/60'
  }

  return props.match.winnerTeamId === teamId
    ? 'border-emerald-500/60 bg-emerald-950/40'
    : 'border-pitch-800 bg-pitch-900/40 text-chalk-400'
}

function currentResult(): MatchResult | null {
  if (props.match.winnerTeamId === null || props.match.loserScore === null) {
    return null
  }

  return {
    winningSide: props.match.winnerTeamId === props.match.blue.teamId ? 'blue' : 'white',
    loserScore: props.match.loserScore,
  }
}
</script>

<template>
  <li class="rounded-xl bg-pitch-900 px-5 py-4">
    <div class="flex items-baseline justify-between gap-4">
      <span class="text-sm text-chalk-400">Match {{ match.order + 1 }}</span>
      <span class="text-sm" :class="match.played ? 'text-emerald-300' : 'text-ball'">
        {{ outcome() }}
      </span>
    </div>

    <div class="mt-3 grid gap-3 sm:grid-cols-2">
      <div class="rounded-lg border px-4 py-3" :class="sideClass('blue')">
        <p class="text-xs tracking-wide text-sky-300 uppercase">Bleu</p>
        <p class="mt-1 font-medium">{{ sideName(match.blue) }}</p>
        <p class="text-xs text-chalk-400">{{ match.blue.teamLabel }}, défense / attaque</p>
      </div>

      <div class="rounded-lg border px-4 py-3" :class="sideClass('white')">
        <p class="text-xs tracking-wide text-chalk-400 uppercase">Blanc</p>
        <p class="mt-1 font-medium">{{ sideName(match.white) }}</p>
        <p class="text-xs text-chalk-400">{{ match.white.teamLabel }}, défense / attaque</p>
      </div>
    </div>

    <MatchScoreEntry
      v-if="unlocked && (!match.played || correcting)"
      :busy="busy"
      :current="correcting ? currentResult() : null"
      @submit="emit('submit', $event)"
      @cancel="emit('cancel')"
    />

    <div v-else-if="unlocked && match.played" class="mt-3 flex flex-wrap items-center gap-3">
      <p class="text-sm text-chalk-400">
        Résultat actuel :
        <span class="text-chalk-100">{{ outcome() }}</span>
      </p>

      <button
        type="button"
        class="rounded-lg border border-pitch-700 px-3 py-1.5 text-sm text-chalk-400 hover:border-ball hover:text-chalk-100"
        @click="emit('correct')"
      >
        Corriger
      </button>
    </div>

    <MatchHistory v-if="records.length > 0" :records="records" />
  </li>
</template>
