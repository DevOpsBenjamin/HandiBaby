import { onScopeDispose, readonly, ref } from 'vue'
import { defineStore } from 'pinia'
import { connectivity } from '@/core/container'

export const useConnectivityStore = defineStore('connectivity', () => {
  const isOnline = ref(connectivity.isOnline)

  connectivity.start()
  const unsubscribe = connectivity.subscribe((online) => {
    isOnline.value = online
  })
  onScopeDispose(unsubscribe)

  return { isOnline: readonly(isOnline) }
})
