<template>
  <div class="main-layout">
    <!-- 自定义标题栏 -->
    <div class="titlebar" @mousedown="startDrag">
      <div class="titlebar-title">
        <span class="logo">🔐</span>
        <span>KeyVault</span>
      </div>
      <div class="titlebar-controls">
        <button class="titlebar-btn" @click="minimize">─</button>
        <button class="titlebar-btn" @click="maximize">□</button>
        <button class="titlebar-btn close" @click="closeWindow">✕</button>
      </div>
    </div>

    <div class="main-content">
      <!-- 侧边栏 -->
      <aside class="sidebar">
        <div class="sidebar-nav">
          <router-link to="/app" class="nav-item" :class="{ active: route.name === 'Dashboard' }">
            <span class="nav-icon">📋</span>
            <span class="nav-text">全部</span>
          </router-link>
          <router-link to="/app?favorites=1" class="nav-item">
            <span class="nav-icon">⭐</span>
            <span class="nav-text">收藏</span>
          </router-link>
          <router-link to="/app/import" class="nav-item" :class="{ active: route.name === 'Import' }">
            <span class="nav-icon">📥</span>
            <span class="nav-text">导入</span>
          </router-link>
          <router-link to="/app/sync" class="nav-item" :class="{ active: route.name === 'Sync' }">
            <span class="nav-icon">☁️</span>
            <span class="nav-text">同步</span>
          </router-link>
        </div>

        <div class="sidebar-groups">
          <div class="group-header">分组</div>
          <div v-for="group in groups" :key="group.id" class="nav-item group-item"
               :class="{ active: currentGroup === group.id }"
               @click="selectGroup(group.id)">
            <span class="nav-icon">{{ groupIcon(group.icon) }}</span>
            <span class="nav-text">{{ group.name }}</span>
          </div>
        </div>

        <div class="sidebar-bottom">
          <router-link to="/app/settings" class="nav-item" :class="{ active: route.name === 'Settings' }">
            <span class="nav-icon">⚙️</span>
            <span class="nav-text">设置</span>
          </router-link>
          <div class="nav-item" @click="lockApp">
            <span class="nav-icon">🔒</span>
            <span class="nav-text">锁定</span>
          </div>
        </div>
      </aside>

      <!-- 主区域 -->
      <main class="content-area">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const groups = ref([])
const currentGroup = ref(null)

const ICONS = {
  folder: '📁', key: '🔑', globe: '🌐', server: '🖥️',
  cloud: '☁️', lock: '🔒', star: '⭐', tag: '🏷️',
}

function groupIcon(icon) {
  return ICONS[icon] || '📁'
}

onMounted(async () => {
  try {
    groups.value = await window.keyvault.groups.list()
  } catch (e) {
    console.error('Load groups failed:', e)
  }
})

function selectGroup(groupId) {
  currentGroup.value = groupId
  router.push({ path: '/app', query: { group: groupId } })
}

async function lockApp() {
  await window.keyvault.auth.lock()
  window.__keyvault_unlocked = false
  router.push('/login')
}

function minimize() { window.keyvault.window.minimize() }
function maximize() { window.keyvault.window.maximize() }
function closeWindow() { window.keyvault.window.close() }
function startDrag() { /* Electron 拖拽区域 */ }
</script>

<style scoped>
.main-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.titlebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
  background: #0a0a0a;
  -webkit-app-region: drag;
  padding: 0 8px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}
.titlebar-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.logo { font-size: 14px; }
.titlebar-controls {
  display: flex;
  -webkit-app-region: no-drag;
}
.titlebar-btn {
  width: 36px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.titlebar-btn:hover { background: #333; }
.titlebar-btn.close:hover { background: #e81123; color: white; }

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 200px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-nav { padding: 8px 0; }
.sidebar-groups { flex: 1; overflow-y: auto; padding: 8px 0; }
.sidebar-bottom { padding: 8px 0; border-top: 1px solid var(--border); }

.group-header {
  padding: 4px 16px;
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.nav-item.active { background: var(--bg-tertiary); color: var(--accent); }
.nav-icon { font-size: 16px; width: 20px; text-align: center; }

.content-area {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary);
}
</style>
