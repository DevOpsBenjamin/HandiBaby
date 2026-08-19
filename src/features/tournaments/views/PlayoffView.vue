<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { db, syncEngine } from '@/core/container'
import { displayName } from '@/features/players/domain/naming'
import type { Player } from '@/features/players/domain/types'
import MatchScoreEntry from '../components/MatchScoreEntry.vue'
import UnlockPanel from '../components/UnlockPanel.vue'
import { Playoff, type PlayoffRound, type PlayoffState } from '../Playoff'
import { ScheduleReader } from '../ScheduleReader'
import { ScoreKeeper } from '../ScoreKeeper'
import { useTournamentsStore } from '../stores/tournaments'
import type { PlayoffPhase } from '../domain/bracket'
import { WINNING_SCORE, type MatchResult } from '../domain/score'
import { SIDE_LABELS, type TableSide, type Team, type Tournament } from '../domain/types'

const props = defineProps<{ publicId: string }>()

const schedule = new ScheduleReader(db)
const playoff = new Playoff(db, new ScoreKeeper(db, syncEngine))
const tournaments = useTournamentsStore()

const PHASE_LABELS: Record<PlayoffPhase, string> = {
  qualification: 'Qualification',
  elimination: 'Éliminatoire',
  'semi-final': 'Demi-finale',
  final: 'Finale',
}

const tournament = ref<Tournament | null>(null)
const state = ref<PlayoffState | null>(null)
const teams = ref<Team[]>([])
const roster = ref<Player[]>([])
const unlocked = ref(false)
const error = ref<string | null>(null)
const saving = ref<PlayoffPhase | null>(null)
const validating = ref<PlayoffPhase | null>(null)
const correcting = ref<PlayoffPhase | null>(null)
const loaded = ref(false)

const isPlayoff = computed(() => tournament.value?.status === 'playoff')
/** A finished edition still shows its bracket; it just has nothing left to enter. */
const hasBracket = computed(() => ['playoff', 'finished'].includes(tournament.value?.status ?? ''))

onMounted(async () => {
  tournament.value = (await tournaments.find(props.publicId)) ?? null
  unlocked.value = tournaments.isUnlocked(props.publicId)

  const id = tournament.value?.id
  if (id !== undefined) {
    ;[teams.value, roster.value] = await Promise.all([
      db.teams.where('tournamentId').equals(id).toArray(),
      schedule.roster(id),
    ])

    if (isPlayoff.value && tournament.value !== null) {
      await playoff.ensureRounds(tournament.value)
    }

    state.value = await playoff.read(id)
  }

  loaded.value = true
})

function teamLabel(teamId: number | null): string {
  return teams.value.find((team) => (team.id ?? 0) === teamId)?.label ?? '—'
}

function playerName(playerId: number): string {
  const player = roster.value.find((candidate) => (candidate.id ?? 0) === playerId)
  return player === undefined ? '—' : displayName(player, roster.value)
}

function sideTeam(round: PlayoffRound, side: TableSide): string {
  return teamLabel(side === 'blue' ? round.blueTeamId : round.whiteTeamId)
}

function configurationOf(teamId: number | null) {
  return state.value?.frozen.configurations.find((row) => row.teamId === teamId) ?? null
}

/** Who actually stands where, which is the thing nobody should have to look up. */
function sidePlayers(round: PlayoffRound, side: TableSide): string {
  const configuration = configurationOf(side === 'blue' ? round.blueTeamId : round.whiteTeamId)

  return configuration === null
    ? '—'
    : `${playerName(configuration.defenderId)} (défense) / ${playerName(configuration.attackerId)} (attaque)`
}

/** Teams are feminine in French, so the first is "1re" and the others are "Ne". */
function rankLabel(teamId: number | null): string {
  const rank = state.value?.frozen.standings.find((row) => row.teamId === teamId)?.rank

  if (rank === undefined) {
    return ''
  }

  return rank === 1 ? '1re' : `${rank}e`
}

function outcome(round: PlayoffRound): string {
  if (round.result === null) {
    return ''
  }

  return `${sideTeam(round, round.result.winningSide)} ${WINNING_SCORE} – ${round.result.loserScore}`
}

async function refresh(): Promise<void> {
  const id = tournament.value?.id
  if (id !== undefined) {
    state.value = await playoff.read(id)
  }
}

async function chooseEnd(phase: PlayoffPhase, end: TableSide): Promise<void> {
  const edition = tournament.value
  if (edition === null) {
    return
  }

  error.value = null

  try {
    await playoff.chooseEnd(edition, phase, end)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    await refresh()
  }
}

/** The last round has no next one to open: confirming it ends the edition. */
function validationLabel(round: PlayoffRound): string {
  if (validating.value === round.phase) {
    return 'Validation…'
  }

  return round.decisive ? 'Match fini, clore le tournoi' : 'Match fini, ouvrir le tour suivant'
}

async function validate(phase: PlayoffPhase): Promise<void> {
  const edition = tournament.value
  if (edition === null) {
    return
  }

  error.value = null
  validating.value = phase

  try {
    await playoff.validate(edition, phase)
    tournament.value = (await tournaments.find(props.publicId)) ?? edition
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    validating.value = null
    await refresh()
  }
}

async function enter(phase: PlayoffPhase, result: MatchResult): Promise<void> {
  const edition = tournament.value
  if (edition === null) {
    return
  }

  error.value = null
  saving.value = phase

  try {
    await playoff.enter(edition, phase, result)
    correcting.value = null
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    saving.value = null
    await refresh()
  }
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

      <h2 class="mt-2 text-2xl font-semibold tracking-tight">Playoff</h2>
      <p class="mt-1 text-chalk-400">
        Système Page : le premier et le deuxième s’affrontent, et celui qui perd tombe en
        demi-finale au lieu de sortir. Le haut du classement s’achète une seconde vie. Les résultats
        du playoff n’alimentent ni le classement, ni les configurations, ni les trophées.
      </p>
    </div>

    <p v-if="!hasBracket" class="rounded-xl bg-pitch-900 px-5 py-4 text-sm text-chalk-400">
      Le playoff s’ouvrira quand la phase de classement aura été validée.
    </p>

    <template v-else-if="state">
      <div class="space-y-3">
        <h3 class="text-sm font-medium tracking-wide text-chalk-400 uppercase">
          Configurations figées
        </h3>
        <p class="text-sm text-chalk-400">
          Décidées à la validation du classement, pour que personne n’en discute à la table.
        </p>

        <ul class="divide-y divide-pitch-800 overflow-hidden rounded-xl bg-pitch-900">
          <li
            v-for="configuration in state.frozen.configurations"
            :key="configuration.teamId"
            class="flex flex-wrap items-baseline gap-x-3 px-5 py-3"
          >
            <span class="mr-auto font-medium">
              {{ teamLabel(configuration.teamId) }}
              <span class="text-sm font-normal text-chalk-400">
                ({{ rankLabel(configuration.teamId) }})
              </span>
            </span>
            <span class="text-sm text-chalk-400">
              {{ playerName(configuration.defenderId) }} en défense,
              {{ playerName(configuration.attackerId) }} en attaque
            </span>
          </li>
        </ul>
      </div>

      <UnlockPanel
        v-if="!unlocked && isPlayoff"
        :tournament="tournament"
        @unlocked="unlocked = true"
      />

      <p
        v-if="error"
        role="alert"
        class="rounded-xl bg-rose-950/60 px-5 py-4 text-sm text-rose-200"
      >
        {{ error }}
      </p>

      <ol class="space-y-3">
        <li
          v-for="round in state.rounds"
          :key="round.phase"
          class="rounded-xl bg-pitch-900 px-5 py-4"
        >
          <div class="flex items-baseline justify-between gap-4">
            <span class="font-medium">{{ PHASE_LABELS[round.phase] }}</span>
            <span v-if="round.result" class="text-sm text-emerald-300">{{ outcome(round) }}</span>
            <span v-else-if="!round.ready" class="text-sm text-chalk-400">En attente</span>
            <span v-else class="text-sm text-ball">À jouer</span>
          </div>

          <p v-if="!round.ready" class="mt-2 text-sm text-chalk-400">
            Ce tour attend le résultat du tour qui l’alimente.
          </p>

          <template v-else>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div
                class="rounded-lg border px-4 py-3"
                :class="
                  round.result && round.result.winningSide === 'blue'
                    ? 'border-emerald-500/60 bg-emerald-950/40'
                    : 'border-sky-500/40 bg-sky-950/30'
                "
              >
                <p class="font-medium">
                  {{ sideTeam(round, 'blue') }}
                  <span
                    v-if="rankLabel(round.blueTeamId)"
                    class="text-xs font-normal text-chalk-400"
                  >
                    ({{ rankLabel(round.blueTeamId) }})
                  </span>
                </p>
                <p class="mt-1 text-sm text-chalk-200">{{ sidePlayers(round, 'blue') }}</p>
                <p class="mt-2 text-xs tracking-wide text-sky-300 uppercase">
                  {{ SIDE_LABELS.blue }}
                </p>
              </div>

              <div
                class="rounded-lg border px-4 py-3"
                :class="
                  round.result && round.result.winningSide === 'white'
                    ? 'border-emerald-500/60 bg-emerald-950/40'
                    : 'border-pitch-700 bg-pitch-800/60'
                "
              >
                <p class="font-medium">
                  {{ sideTeam(round, 'white') }}
                  <span
                    v-if="rankLabel(round.whiteTeamId)"
                    class="text-xs font-normal text-chalk-400"
                  >
                    ({{ rankLabel(round.whiteTeamId) }})
                  </span>
                </p>
                <p class="mt-1 text-sm text-chalk-200">{{ sidePlayers(round, 'white') }}</p>
                <p class="mt-2 text-xs tracking-wide text-chalk-400 uppercase">
                  {{ SIDE_LABELS.white }}
                </p>
              </div>
            </div>

            <div
              v-if="unlocked && isPlayoff && !round.result"
              class="mt-3 flex flex-wrap items-center gap-2 text-sm"
            >
              <span class="text-chalk-400">
                {{ teamLabel(round.choosesEnd) }} est la mieux classée ({{
                  rankLabel(round.choosesEnd)
                }}) et choisit son bout de table :
              </span>
              <button
                v-for="side in ['blue', 'white'] as TableSide[]"
                :key="side"
                type="button"
                class="rounded-lg border px-3 py-1.5 text-sm"
                :class="
                  round.choosesEnd === (side === 'blue' ? round.blueTeamId : round.whiteTeamId)
                    ? 'border-ball text-chalk-100'
                    : 'border-pitch-700 text-chalk-400 hover:border-ball'
                "
                @click="chooseEnd(round.phase, side)"
              >
                {{ SIDE_LABELS[side] }}
              </button>
            </div>

            <MatchScoreEntry
              v-if="unlocked && isPlayoff && (!round.result || correcting === round.phase)"
              :busy="saving === round.phase"
              :current="correcting === round.phase ? round.result : null"
              @submit="enter(round.phase, $event)"
              @cancel="correcting = null"
            />

            <div
              v-else-if="unlocked && isPlayoff && round.awaitingValidation"
              class="mt-3 space-y-3"
            >
              <p class="text-sm text-chalk-400">
                Le score reste modifiable tant que le match n’est pas validé.
              </p>

              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="rounded-lg bg-ball px-4 py-2 font-semibold text-pitch-950 disabled:opacity-40"
                  :disabled="validating === round.phase"
                  @click="validate(round.phase)"
                >
                  {{ validationLabel(round) }}
                </button>

                <button
                  type="button"
                  class="rounded-lg border border-pitch-700 px-3 py-1.5 text-sm text-chalk-400 hover:border-ball hover:text-chalk-100"
                  @click="correcting = round.phase"
                >
                  Corriger
                </button>
              </div>
            </div>

            <p v-else-if="round.validated" class="mt-3 text-sm text-chalk-400">Match validé.</p>
          </template>
        </li>
      </ol>
    </template>
  </section>
</template>
