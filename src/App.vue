<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt.vue'
import SyncStatusBadge from '@/components/SyncStatusBadge.vue'
</script>

<template>
  <div class="min-h-dvh">
    <header class="border-b border-pitch-800">
      <div class="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-6 py-4">
        <h1 class="text-lg font-semibold tracking-tight">
          <RouterLink to="/">HandiBaby</RouterLink>
        </h1>

        <nav class="mr-auto">
          <RouterLink to="/joueurs" class="text-sm text-chalk-400 hover:text-chalk-100">
            Vivier
          </RouterLink>
        </nav>

        <SyncStatusBadge />
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-6 py-10">
      <RouterView />
    </main>

    <PwaUpdatePrompt />
  </div>
</template>
