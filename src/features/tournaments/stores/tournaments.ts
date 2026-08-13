import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/core/container'
import { TournamentRepository, type DraftInput } from '../TournamentRepository'
import { DeviceUnlocks } from '../unlocks'
import { verifyPassphrase } from '../domain/passphrase'
import type { Tournament } from '../domain/types'

const repository = new TournamentRepository(db)
const unlocks = new DeviceUnlocks()

export const useTournamentsStore = defineStore('tournaments', () => {
  const inProgress = ref<Tournament[]>([])
  const finished = ref<Tournament[]>([])
  const loading = ref(false)

  const hasSingleInProgress = computed(() => inProgress.value.length === 1)
  const soleInProgress = computed<Tournament | null>(() =>
    hasSingleInProgress.value ? (inProgress.value[0] ?? null) : null,
  )
  const isEmpty = computed(
    () => !loading.value && inProgress.value.length === 0 && finished.value.length === 0,
  )

  async function load(): Promise<void> {
    loading.value = true
    try {
      const [open, closed] = await Promise.all([
        repository.listInProgress(),
        repository.listFinished(),
      ])
      inProgress.value = open
      finished.value = closed
    } finally {
      loading.value = false
    }
  }

  /** Creating an edition unlocks it here: there is nothing yet to verify against. */
  async function createDraft(input: DraftInput): Promise<Tournament> {
    const created = await repository.createDraft(input)
    unlocks.unlock(created.publicId)
    await load()
    return created
  }

  async function find(publicId: string): Promise<Tournament | undefined> {
    return repository.findByPublicId(publicId)
  }

  function isUnlocked(publicId: string): boolean {
    return unlocks.isUnlocked(publicId)
  }

  /** Checked against the local verifier, so it works with no network. */
  async function unlock(tournament: Tournament, passphrase: string): Promise<boolean> {
    const accepted = await verifyPassphrase(passphrase, tournament.passphraseHash)

    if (accepted) {
      unlocks.unlock(tournament.publicId)
    }

    return accepted
  }

  return {
    inProgress,
    finished,
    loading,
    isEmpty,
    hasSingleInProgress,
    soleInProgress,
    load,
    createDraft,
    find,
    isUnlocked,
    unlock,
  }
})
