<template>
  <aside class="sidebar">
    <div class="sidebar-search">
      <div class="search-trigger" @click="$emit('openCommandPalette')">
        <Search :size="14" />
        <span>搜索...</span>
        <kbd>Ctrl+K</kbd>
      </div>
    </div>

    <nav class="sidebar-nav">
      <router-link to="/app" class="nav-item" :class="{ active: route.name === 'Dashboard' && !route.query.group && !route.query.favorites }">
        <Home :size="16" />
        <span>全部</span>
        <span class="nav-count">{{ totalCount }}</span>
      </router-link>
      <router-link to="/app?favorites=1" class="nav-item" :class="{ active: route.query.favorites }">
        <Star :size="16" />
        <span>收藏</span>
      </router-link>
      <router-link to="/app?recent=1" class="nav-item" :class="{ active: route.query.recent }">
        <Clock :size="16" />
        <span>最近使用</span>
      </router-link>
    </nav>

    <div class="sidebar-groups">
      <div class="group-header">
        <span>分组</span>
        <button class="group-add-btn" @click="$emit('addGroup')" title="新建分组">
          <Plus :size="14" />
        </button>
      </div>
      <div v-for="group in groupsStore.groups" :key="group.id"
           class="nav-item group-item"
           :class="{ active: currentGroup === group.id }"
           @click="selectGroup(group.id)"
           @contextmenu.prevent="$emit('groupContext', $event, group)">
        <Folder :size="16" />
        <span class="nav-text">{{ group.name }}</span>
      </div>
    </div>

    <div class="sidebar-bottom">
      <router-link to="/app/import" class="nav-item" :class="{ active: route.name === 'Import' }">
        <Download :size="16" />
        <span>导入</span>
      </router-link>
      <router-link to="/app/sync" class="nav-item" :class="{ active: route.name === 'Sync' }">
        <RefreshCw :size="16" />
        <span>同步</span>
      </router-link>
      <router-link to="/app/settings" class="nav-item" :class="{ active: route.name === 'Settings' }">
        <Settings :size="16" />
        <span>设置</span>
      </router-link>
      <div class="nav-item" @click="$emit('lock')">
        <Lock :size="16" />
        <span>锁定</span>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGroupsStore } from '@/stores/groups'

defineProps({
  totalCount: { type: Number, default: 0 },
})

defineEmits(['openCommandPalette', 'addGroup', 'groupContext', 'lock'])

const route = useRoute()
const router = useRouter()
const groupsStore = useGroupsStore()
const currentGroup = computed(() => route.query.group || null)

function selectGroup(groupId) {
  router.push({ path: '/app', query: { group: groupId } })
}
</script>

<style scoped>
.sidebar {
  width: 240px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  user-select: none;
}

.sidebar-search {
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.search-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.search-trigger:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}
.search-trigger kbd {
  margin-left: auto;
  padding: 2px 6px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
}

.sidebar-nav {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.sidebar-groups {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.sidebar-bottom {
  padding: 8px 0;
  border-top: 1px solid var(--border);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px;
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.group-add-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}
.group-add-btn:hover {
  color: var(--accent);
  background: var(--bg-hover);
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
.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.nav-item.active {
  background: var(--bg-tertiary);
  color: var(--accent);
}

.nav-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-count {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 10px;
}
</style>
