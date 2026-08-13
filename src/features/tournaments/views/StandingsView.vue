<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { db } from '@/core/container'
import { StandingsReader, type StandingsView } from '../StandingsReader'
import { useTournamentsStore } from '../stores/tournaments'
import { POINTS_PER_WIN, type SeparationLevel } from '../domain/standings'
import type { Tournament } from '../domain/types'

const props = defineProps<{ publicId: string }>()

const reader = new StandingsReader(db)
const tournaments = useTournamentsStore()

const tournament = ref<Tournament | null>(null)
const view = ref<StandingsView | null>(null)
const loaded = ref(false)

const SEPARATION_LABELS: Record<SeparationLevel, string> = {
  points: 'aux points',
  'head-to-head': 'au duel direct',
  'head-to-head-goal-difference': 'à la différence de buts du duel direct',
  'goal-difference': 'à la différence de buts générale',
  unresolved: 'départage impossible',
}

onMounted(async () => {
  tournament.value = (await tournaments.find(props.publicId)) ?? null

  const id = tournament.value?.id
  if (id !== undefined) {
    view.value = await reader.read(id)
  }

  loaded.value = true
})

function signed(difference: number): string {
  return difference > 0 ? `+${difference}` : String(difference)
}
</script>

<template>
  <section v-if="loaded && tournament === null" class="text-chalk-400">
    Cette édition est introuvable sur cet appareil.
  </section>

  <section v-else-if="view" class="space-y-8">
    <div>
      <RouterLink
        :to="{ name: 'tournament', params: { publicId } }"
        class="text-sm text-chalk-400 hover:text-chalk-100"
      >
        ← {{ tournament?.label }}
      </RouterLink>

      <h2 class="mt-2 text-2xl font-semibold tracking-tight">Classement</h2>
      <p class="mt-1 text-chalk-400">
        {{ POINTS_PER_WIN }} points par victoire, rien pour une défaite. Le classement se recalcule
        à chaque score saisi, sans réseau. Les matchs de playoff n’y entrent jamais.
      </p>
    </div>

    <div class="overflow-x-auto rounded-xl bg-pitch-900">
      <table class="w-full text-sm">
        <thead class="text-chalk-400">
          <tr class="border-b border-pitch-800">
            <th class="px-4 py-3 text-left font-medium">#</th>
            <th class="px-4 py-3 text-left font-medium">Équipe</th>
            <th class="px-4 py-3 text-right font-medium">J</th>
            <th class="px-4 py-3 text-right font-medium">V</th>
            <th class="px-4 py-3 text-right font-medium">D</th>
            <th class="px-4 py-3 text-right font-medium">Buts</th>
            <th class="px-4 py-3 text-right font-medium">Diff.</th>
            <th class="px-4 py-3 text-right font-medium">Pts</th>
          </tr>
        </thead>

        <tbody>
          <template v-for="row in view.rows" :key="row.teamId">
            <tr class="border-b border-pitch-800/60 last:border-0">
              <td class="px-4 py-3 text-chalk-400">{{ row.rank }}</td>
              <td class="px-4 py-3">
                <span class="font-medium">{{ row.teamLabel }}</span>
                <span class="block text-xs text-chalk-400">{{ row.players }}</span>
              </td>
              <td class="px-4 py-3 text-right text-chalk-400">{{ row.played }}</td>
              <td class="px-4 py-3 text-right">{{ row.wins }}</td>
              <td class="px-4 py-3 text-right text-chalk-400">{{ row.losses }}</td>
              <td class="px-4 py-3 text-right text-chalk-400">
                {{ row.goalsFor }} : {{ row.goalsAgainst }}
              </td>
              <td class="px-4 py-3 text-right">{{ signed(row.goalDifference) }}</td>
              <td class="px-4 py-3 text-right font-semibold text-ball">{{ row.points }}</td>
            </tr>

            <tr v-if="row.separation">
              <td colspan="8" class="px-4 pb-2 text-xs text-chalk-400">
                <span v-if="row.separation === 'unresolved'" class="text-amber-300">
                  Rien ne sépare ces équipes : l’arbitrage revient aux organisateurs.
                </span>
                <span v-else>Départagé {{ SEPARATION_LABELS[row.separation] }}</span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p
      v-for="group in view.arbitration"
      :key="group.join()"
      role="alert"
      class="rounded-xl bg-amber-950/50 px-5 py-4 text-sm text-amber-200"
    >
      {{ group.join(', ') }} ne peuvent pas être départagées par les règles. Les organisateurs
      tranchent : l’application ne va pas inventer un critère que personne n’a accepté.
    </p>

    <div class="space-y-3">
      <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">
        Meilleure configuration
      </h3>
      <p class="text-sm text-chalk-400">
        Aux victoires d’abord, à la différence de buts ensuite. C’est celle que l’équipe jouera en
        playoff.
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="configuration in view.configurations"
          :key="configuration.teamId"
          class="rounded-xl bg-pitch-900 px-5 py-4"
        >
          <p class="font-medium">{{ configuration.teamLabel }}</p>

          <p v-if="configuration.options.length === 0" class="mt-2 text-sm text-chalk-400">
            Aucun match joué pour l’instant.
          </p>

          <ol v-else class="mt-2 space-y-1">
            <li
              v-for="(option, index) in configuration.options"
              :key="`${option.defenderId}-${option.attackerId}`"
              class="text-sm"
              :class="index === 0 && !configuration.tied ? 'text-emerald-300' : 'text-chalk-400'"
            >
              {{ option.defender }} en défense, {{ option.attacker }} en attaque ·
              {{ option.wins }} V sur {{ option.played }}, {{ signed(option.goalDifference) }}
            </li>
          </ol>

          <p v-if="configuration.tied" class="mt-2 text-xs text-amber-300">
            Les deux configurations sont à égalité. C’est à l’équipe de trancher, elle est la seule
            concernée.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
