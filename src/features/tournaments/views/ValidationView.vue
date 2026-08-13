<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { db } from '@/core/container'
import UnlockPanel from '../components/UnlockPanel.vue'
import { GroupPhase, type ClosingPreview, type ConfigurationChoices } from '../GroupPhase'
import { StandingsReader, type StandingsView } from '../StandingsReader'
import { useTournamentsStore } from '../stores/tournaments'
import type { Tournament } from '../domain/types'

const props = defineProps<{ publicId: string }>()

const router = useRouter()
const groupPhase = new GroupPhase(db)
const standings = new StandingsReader(db)
const tournaments = useTournamentsStore()

const tournament = ref<Tournament | null>(null)
const preview = ref<ClosingPreview | null>(null)
const view = ref<StandingsView | null>(null)
const unlocked = ref(false)
const error = ref<string | null>(null)
const closing = ref(false)
const loaded = ref(false)

/** One entry per team that has to pick, holding the id of the player who defends. */
const choices = ref<Record<number, number | null>>({})
/** One entry per group the cascade could not order, held in the settled order. */
const arbitration = ref<number[][]>([])

const isRoundRobin = computed(() => tournament.value?.status === 'round-robin')

const everyChoiceMade = computed(() =>
  (preview.value?.awaitingChoice ?? []).every((teamId) => choices.value[teamId] != null),
)

const everyGroupSettled = computed(
  () => (preview.value?.awaitingArbitration ?? []).length === arbitration.value.length,
)

const canConfirm = computed(
  () =>
    unlocked.value &&
    isRoundRobin.value &&
    preview.value !== null &&
    preview.value.remaining === 0 &&
    everyChoiceMade.value &&
    everyGroupSettled.value &&
    !closing.value,
)

onMounted(async () => {
  tournament.value = (await tournaments.find(props.publicId)) ?? null
  unlocked.value = tournaments.isUnlocked(props.publicId)

  const id = tournament.value?.id
  if (id !== undefined) {
    preview.value = await groupPhase.preview(id)
    view.value = await standings.read(id)

    for (const teamId of preview.value.awaitingChoice) {
      choices.value[teamId] = null
    }

    // Seeded with the order the table happened to present, which carries no
    // claim: the organisers are the ones deciding it.
    arbitration.value = preview.value.awaitingArbitration.map((group) => [...group])
  }

  loaded.value = true
})

function optionsFor(teamId: number) {
  return view.value?.configurations.find((row) => row.teamId === teamId)?.options ?? []
}

function teamName(teamId: number): string {
  return view.value?.rows.find((row) => row.teamId === teamId)?.teamLabel ?? ''
}

/** Moves a team within its group. The order stands as the organisers' decision. */
function move(groupIndex: number, from: number, direction: -1 | 1): void {
  const group = arbitration.value[groupIndex]
  const to = from + direction

  if (group === undefined || to < 0 || to >= group.length) {
    return
  }

  const moved = group[from]
  const displaced = group[to]

  if (moved === undefined || displaced === undefined) {
    return
  }

  group[from] = displaced
  group[to] = moved
}

async function confirm(): Promise<void> {
  const edition = tournament.value

  if (edition === null || !canConfirm.value) {
    return
  }

  error.value = null
  closing.value = true

  try {
    const picked: Record<number, number> = {}
    for (const [teamId, defenderId] of Object.entries(choices.value)) {
      if (defenderId != null) {
        picked[Number(teamId)] = defenderId
      }
    }

    await groupPhase.close(edition, picked satisfies ConfigurationChoices, arbitration.value)
    await router.replace({ name: 'tournament', params: { publicId: props.publicId } })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    closing.value = false
  }
}
</script>

<template>
  <section v-if="loaded && tournament === null" class="text-chalk-400">
    Cette édition est introuvable sur cet appareil.
  </section>

  <section v-else-if="tournament && preview" class="space-y-8">
    <div>
      <RouterLink
        :to="{ name: 'tournament', params: { publicId } }"
        class="text-sm text-chalk-400 hover:text-chalk-100"
      >
        ← {{ tournament.label }}
      </RouterLink>

      <h2 class="mt-2 text-2xl font-semibold tracking-tight">Clôturer la phase de classement</h2>
      <p class="mt-1 text-chalk-400">
        Une fois validée, la phase de classement est figée : le classement, les configurations et le
        tableau du playoff deviennent des données de l’édition, et les scores ne sont plus
        modifiables. Il n’y a pas de retour en arrière depuis l’application.
      </p>
    </div>

    <p v-if="!isRoundRobin" class="rounded-xl bg-pitch-900 px-5 py-4 text-sm text-chalk-400">
      Cette phase de classement est déjà validée.
    </p>

    <template v-else>
      <p
        v-if="preview.remaining > 0"
        class="rounded-xl bg-pitch-900 px-5 py-4 text-sm text-chalk-400"
      >
        Il reste {{ preview.remaining }} match{{ preview.remaining > 1 ? 's' : '' }} à saisir. La
        validation s’ouvrira quand tout sera entré.
      </p>

      <div
        v-for="(group, groupIndex) in arbitration"
        :key="groupIndex"
        class="space-y-3 rounded-xl bg-amber-950/40 px-5 py-4"
      >
        <h3 class="text-sm font-medium text-amber-200">Départage à trancher</h3>

        <p class="text-sm text-amber-200/80">
          La cascade a été jusqu’au bout sans séparer
          {{ group.map(teamName).join(', ') }} : mêmes points, même bilan en duel direct et même
          différence de buts. Les règles s’arrêtent là et laissent l’arbitrage aux organisateurs. Le
          playoff se sème sur cet ordre, alors c’est à vous de le fixer.
        </p>

        <ol class="divide-y divide-amber-900/40 overflow-hidden rounded-lg bg-pitch-900">
          <li
            v-for="(teamId, position) in group"
            :key="teamId"
            class="flex items-center gap-3 px-4 py-2"
          >
            <span class="text-sm text-chalk-400">{{ position + 1 }}</span>
            <span class="mr-auto font-medium">{{ teamName(teamId) }}</span>

            <button
              type="button"
              class="rounded-lg border border-pitch-700 px-2 py-1 text-sm text-chalk-400 hover:border-ball hover:text-chalk-100 disabled:opacity-30"
              :disabled="position === 0"
              @click="move(groupIndex, position, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="rounded-lg border border-pitch-700 px-2 py-1 text-sm text-chalk-400 hover:border-ball hover:text-chalk-100 disabled:opacity-30"
              :disabled="position === group.length - 1"
              @click="move(groupIndex, position, 1)"
            >
              ↓
            </button>
          </li>
        </ol>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">Classement final</h3>

        <ol class="divide-y divide-pitch-800 overflow-hidden rounded-xl bg-pitch-900">
          <li
            v-for="row in view?.rows ?? []"
            :key="row.teamId"
            class="flex flex-wrap items-baseline gap-x-3 px-5 py-3"
          >
            <span class="text-sm text-chalk-400">{{ row.rank }}</span>
            <span class="mr-auto font-medium">{{ row.teamLabel }}</span>
            <span class="text-xs text-chalk-400">{{ row.players }}</span>
            <span class="text-sm font-semibold text-ball">{{ row.points }} pts</span>
          </li>
        </ol>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">
          Configurations de playoff
        </h3>

        <div
          v-for="configuration in view?.configurations ?? []"
          :key="configuration.teamId"
          class="rounded-xl bg-pitch-900 px-5 py-4"
        >
          <p class="font-medium">{{ configuration.teamLabel }}</p>

          <template v-if="preview.awaitingChoice.includes(configuration.teamId)">
            <p class="mt-1 text-sm text-amber-300">
              Les deux configurations sont à égalité. C’est à cette équipe de choisir.
            </p>

            <label class="mt-2 block text-sm">
              <span class="text-chalk-400">Configuration retenue</span>
              <select
                v-model="choices[configuration.teamId]"
                class="mt-1 w-full rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-chalk-100 outline-none focus:border-ball"
              >
                <option :value="null">—</option>
                <option
                  v-for="option in optionsFor(configuration.teamId)"
                  :key="option.defenderId"
                  :value="option.defenderId"
                >
                  {{ option.defender }} en défense, {{ option.attacker }} en attaque
                </option>
              </select>
            </label>
          </template>

          <p v-else-if="configuration.options[0]" class="mt-1 text-sm text-emerald-300">
            {{ configuration.options[0].defender }} en défense,
            {{ configuration.options[0].attacker }} en attaque
          </p>
        </div>
      </div>

      <UnlockPanel v-if="!unlocked" :tournament="tournament" @unlocked="unlocked = true" />

      <p
        v-if="error"
        role="alert"
        class="rounded-xl bg-rose-950/60 px-5 py-4 text-sm text-rose-200"
      >
        {{ error }}
      </p>

      <button
        type="button"
        class="rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950 disabled:opacity-40"
        :disabled="!canConfirm"
        @click="confirm"
      >
        {{ closing ? 'Validation…' : 'Valider et ouvrir le playoff' }}
      </button>
    </template>
  </section>
</template>
