import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db } from '@/core/container'
import { PlayerRepository } from '../PlayerRepository'
import type { Player } from '../domain/types'

const repository = new PlayerRepository(db)

export const usePlayerPoolStore = defineStore('player-pool', () => {
  const players = ref<Player[]>([])
  const loading = ref(false)

  const isEmpty = computed(() => !loading.value && players.value.length === 0)

  async function load(): Promise<void> {
    loading.value = true
    try {
      players.value = await repository.list()
    } finally {
      loading.value = false
    }
  }

  /** Throws DuplicatePlayerError or BlankPlayerNameError; callers show the message. */
  async function add(firstName: string, lastName: string): Promise<Player> {
    const created = await repository.create(firstName, lastName)
    await load()
    return created
  }

  return { players, loading, isEmpty, load, add }
})
