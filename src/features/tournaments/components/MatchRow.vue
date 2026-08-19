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
  swapMessage?: string | null
}>()

const emit = defineEmits<{
  submit: [MatchResult]
  correct: []
  cancel: []
  swapSides: []
}>()

function name(player: Player | null): string {
  return player === null ? '—' : displayName(player, props.roster)
}

function sidePlayers(side: MatchSide): string {
  if (side.defender === null && side.attacker === null) {
    return '—'
  }
  return `${name(side.defender)} (défense) / ${name(side.attacker)} (attaque)`
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
        <p class="font-medium">{{ match.blue.teamLabel }}</p>
        <p class="mt-1 text-sm text-chalk-200">{{ sidePlayers(match.blue) }}</p>
        <p class="mt-2 text-xs tracking-wide text-sky-300 uppercase">Bleu</p>
      </div>

      <div class="rounded-lg border px-4 py-3" :class="sideClass('white')">
        <p class="font-medium">{{ match.white.teamLabel }}</p>
        <p class="mt-1 text-sm text-chalk-200">{{ sidePlayers(match.white) }}</p>
        <p class="mt-2 text-xs tracking-wide text-chalk-400 uppercase">Blanc</p>
      </div>
    </div>

    <div
      v-if="unlocked && (!match.played || correcting)"
      class="mt-2 flex flex-wrap items-center justify-between gap-2"
    >
      <p v-if="swapMessage" class="text-xs text-amber-300">
        {{ swapMessage }}
      </p>
      <span v-else></span>

      <button
        type="button"
        class="flex items-center gap-1.5 rounded py-1 px-2 text-xs text-chalk-400 hover:bg-pitch-800 hover:text-chalk-100"
        :disabled="busy"
        @click="emit('swapSides')"
      >
        <span aria-hidden="true">⇄</span> Inverser les côtés (mauvaise couleur)
      </button>
    </div>

    <MatchScoreEntry
      v-if="unlocked && (!match.played || correcting)"
      :busy="busy"
      :current="correcting ? currentResult() : null"
      :blue-team-label="match.blue.teamLabel"
      :white-team-label="match.white.teamLabel"
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
