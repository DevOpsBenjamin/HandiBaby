import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/joueurs',
      name: 'player-pool',
      component: () => import('@/features/players/views/PlayerPoolView.vue'),
    },
  ],
})

export default router
