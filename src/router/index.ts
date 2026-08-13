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
      path: '/tournois',
      name: 'tournament-list',
      component: () => import('@/features/tournaments/views/TournamentListView.vue'),
    },
    {
      path: '/tournois/nouveau',
      name: 'tournament-create',
      component: () => import('@/features/tournaments/views/TournamentCreateView.vue'),
    },
    {
      path: '/tournois/:publicId',
      name: 'tournament',
      component: () => import('@/features/tournaments/views/TournamentView.vue'),
      props: true,
    },
    {
      path: '/tournois/:publicId/joueurs',
      name: 'tournament-participants',
      component: () => import('@/features/tournaments/views/TournamentParticipantsView.vue'),
      props: true,
    },
    {
      path: '/tournois/:publicId/equipes',
      name: 'tournament-teams',
      component: () => import('@/features/tournaments/views/TournamentTeamsView.vue'),
      props: true,
    },
    {
      path: '/joueurs',
      name: 'player-pool',
      component: () => import('@/features/players/views/PlayerPoolView.vue'),
    },
  ],
})

export default router
