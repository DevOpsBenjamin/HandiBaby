<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { displayName } from '@/features/players/domain/naming'
import type { Player } from '@/features/players/domain/types'
import type { DuelSummary } from '../ScheduleReader'

defineProps<{
  publicId: string
  duels: readonly DuelSummary[]
  roster: readonly Player[]
}>()

function teamNames(duel: DuelSummary, roster: readonly Player[]): string[] {
  return duel.teams.map((team) =>
    team.players.map((player) => displayName(player, roster)).join(' et '),
  )
}
</script>

<template>
  <ul class="divide-y divide-pitch-800 overflow-hidden rounded-xl bg-pitch-900">
    <li v-for="duel in duels" :key="duel.duel">
      <RouterLink
        :to="{ name: 'duel', params: { publicId, duel: duel.duel } }"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4 hover:bg-pitch-800"
      >
        <span class="text-sm text-chalk-400">Duel {{ duel.duel }}</span>

        <span class="mr-auto font-medium">
          {{ teamNames(duel, roster).join(' contre ') }}
        </span>

        <span class="text-sm" :class="duel.complete ? 'text-chalk-400' : 'text-ball'">
          {{ duel.playedMatches }} / {{ duel.totalMatches }}
        </span>
      </RouterLink>
    </li>
  </ul>
</template>
