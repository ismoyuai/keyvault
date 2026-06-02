import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'Login', component: () => import('@/views/LoginView.vue') },
  {
    path: '/app',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'Dashboard', component: () => import('@/views/DashboardView.vue') },
      { path: 'entry/:id', name: 'EntryDetail', component: () => import('@/views/EntryDetailView.vue') },
      { path: 'import', name: 'Import', component: () => import('@/views/ImportView.vue') },
      { path: 'settings', name: 'Settings', component: () => import('@/views/SettingsView.vue') },
      { path: 'sync', name: 'Sync', component: () => import('@/views/SyncView.vue') },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.path !== '/login' && !auth.isUnlocked) {
    return '/login'
  }
})

export default router
