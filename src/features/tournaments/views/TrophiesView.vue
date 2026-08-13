<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { db } from '@/core/container'
import { TrophyReader, type TrophyBoard } from '../TrophyReader'
import { useTournamentsStore } from '../stores/tournaments'
import type { Tournament } from '../domain/types'

const props = defineProps<{ publicId: string }>()

const reader = new TrophyReader(db)
const tournaments = useTournamentsStore()

const tournament = ref<Tournament | null>(null)
const edition = ref<TrophyBoard | null>(null)
const cumulative = ref<TrophyBoard | null>(null)
const loaded = ref(false)

onMounted(async () => {
  tournament.value = (await tournaments.find(props.publicId)) ?? null

  const id = tournament.value?.id
  if (id !== undefined) {
    edition.value = await reader.forEdition(id)
  }

  cumulative.value = await reader.cumulative()
  loaded.value = true
})

function average(value: number | null): string {
  return value === null ? '—' : value.toFixed(2)
}
</script>

<template>
  <section v-if="loaded && tournament === null" class="text-chalk-400">
    Cette édition est introuvable sur cet appareil.
  </section>

  <section v-else-if="tournament" class="space-y-8">
    <div>
      <RouterLink
        :to="{ name: 'tournament', params: { publicId } }"
        class="text-sm text-chalk-400 hover:text-chalk-100"
      >
        ← {{ tournament.label }}
      </RouterLink>

      <h2 class="mt-2 text-2xl font-semibold tracking-tight">Trophées</h2>
      <p class="mt-1 text-chalk-400">
        Meilleur défenseur : la moyenne de buts encaissés la plus basse sur les matchs tenus en
        défense. Meilleur attaquant : la moyenne de buts marqués la plus haute en attaque. Seuls les
        matchs de classement comptent.
      </p>
    </div>

    <div
      v-for="board in [
        { title: 'Cette édition', data: edition, single: true },
        { title: 'Toutes éditions confondues', data: cumulative, single: false },
      ]"
      :key="board.title"
      class="space-y-3"
    >
      <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">{{ board.title }}</h3>

      <p v-if="board.single" class="rounded-xl bg-amber-950/40 px-5 py-4 text-sm text-amber-200/90">
        Sur une seule édition, ces trophées décrivent une paire dans une configuration, pas une
        personne : les matchs où l’un défend sont exactement ceux où l’autre attaque, donc rien dans
        les données ne sépare leurs contributions. Et comme un match se gagne à dix, les buts
        marqués disent presque la même chose que les victoires ; seule la marge ajoute de
        l’information. Le cumul de toutes les éditions, où les binômes changent, est la seule
        échelle où « meilleur défenseur » désigne quelqu’un.
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl bg-pitch-900 px-5 py-4">
          <p class="text-xs tracking-wide text-chalk-400 uppercase">Meilleur défenseur</p>
          <p class="mt-1 text-lg font-semibold">{{ board.data?.defender?.name ?? '—' }}</p>
          <p class="text-sm text-chalk-400">
            {{ average(board.data?.defender?.concededPerMatch ?? null) }} but(s) encaissé(s) par
            match, sur {{ board.data?.defender?.matchesDefended ?? 0 }} match(s) en défense
          </p>
        </div>

        <div class="rounded-xl bg-pitch-900 px-5 py-4">
          <p class="text-xs tracking-wide text-chalk-400 uppercase">Meilleur attaquant</p>
          <p class="mt-1 text-lg font-semibold">{{ board.data?.attacker?.name ?? '—' }}</p>
          <p class="text-sm text-chalk-400">
            {{ average(board.data?.attacker?.scoredPerMatch ?? null) }} but(s) marqué(s) par match,
            sur {{ board.data?.attacker?.matchesAttacked ?? 0 }} match(s) en attaque
          </p>
        </div>
      </div>

      <p v-if="(board.data?.players ?? []).length === 0" class="text-sm text-chalk-400">
        Aucun match de classement joué pour l’instant.
      </p>

      <div v-else class="overflow-x-auto rounded-xl bg-pitch-900">
        <table class="w-full text-sm">
          <thead class="text-chalk-400">
            <tr class="border-b border-pitch-800">
              <th class="px-4 py-3 text-left font-medium">Joueur</th>
              <th class="px-4 py-3 text-right font-medium">Déf.</th>
              <th class="px-4 py-3 text-right font-medium">Encaissés / match</th>
              <th class="px-4 py-3 text-right font-medium">Att.</th>
              <th class="px-4 py-3 text-right font-medium">Marqués / match</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="player in board.data?.players ?? []"
              :key="player.playerId"
              class="border-b border-pitch-800/60 last:border-0"
            >
              <td class="px-4 py-3 font-medium">{{ player.name }}</td>
              <td class="px-4 py-3 text-right text-chalk-400">{{ player.matchesDefended }}</td>
              <td class="px-4 py-3 text-right">{{ average(player.concededPerMatch) }}</td>
              <td class="px-4 py-3 text-right text-chalk-400">{{ player.matchesAttacked }}</td>
              <td class="px-4 py-3 text-right">{{ average(player.scoredPerMatch) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
