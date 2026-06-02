import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/app',
    name: 'Main',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('../views/DashboardView.vue')
      },
      {
        path: 'entry/:id',
        name: 'EntryDetail',
        component: () => import('../views/EntryDetailView.vue')
      },
      {
        path: 'import',
        name: 'Import',
        component: () => import('../views/ImportView.vue')
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/SettingsView.vue')
      },
      {
        path: 'sync',
        name: 'Sync',
        component: () => import('../views/SyncView.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 全局前置守卫：检查是否已解锁
router.beforeEach((to, from, next) => {
  if (to.name !== 'Login' && !window.__keyvault_unlocked) {
    next({ name: 'Login' })
  } else {
    next()
  }
})

export default router
