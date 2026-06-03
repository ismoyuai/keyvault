<template>
  <div class="main-layout">
    <div class="titlebar" @mousedown="startDrag">
      <div class="titlebar-title">
        <Shield :size="14" />
        <span>KeyVault</span>
      </div>
      <div class="titlebar-controls">
        <button class="titlebar-btn" @click="minimize"><Minus :size="12" /></button>
        <button class="titlebar-btn" @click="maximize"><Square :size="12" /></button>
        <button class="titlebar-btn close" @click="closeWindow"><X :size="12" /></button>
      </div>
    </div>

    <div class="main-content">
      <Sidebar
        :total-count="entriesStore.entries.length"
        @open-command-palette="showCommandPalette = true"
        @add-group="promptAddGroup"
        @lock="lockApp"
      />
      <main class="content-area">
        <router-view />
      </main>
    </div>

    <CommandPalette v-model="showCommandPalette" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/groups'
import { useEntriesStore } from '@/stores/entries'
import Sidebar from '@/components/Sidebar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { ElMessageBox, ElMessage } from 'element-plus'

const router = useRouter()
const auth = useAuthStore()
const groupsStore = useGroupsStore()
const entriesStore = useEntriesStore()
const showCommandPalette = ref(false)

onMounted(() => {
  groupsStore.loadGroups()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function handleKeydown(e) {
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault()
    showCommandPalette.value = !showCommandPalette.value
  }
  if (e.ctrlKey && e.key === 'l') {
    e.preventDefault()
    lockApp()
  }
}

async function promptAddGroup() {
  try {
    const { value } = await ElMessageBox.prompt('输入分组名称', '新建分组', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /^.{1,20}$/,
      inputErrorMessage: '名称长度 1-20 字符',
    })
    await groupsStore.addGroup(value)
    ElMessage.success('分组已创建')
  } catch {}
}

function lockApp() {
  auth.lock()
  router.push('/login')
}

function minimize() { window.keyvault.window.minimize() }
function maximize() { window.keyvault.window.maximize() }
function closeWindow() { window.keyvault.window.close() }
function startDrag() {}
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
  background: var(--bg-secondary);
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
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.titlebar-btn:hover { background: var(--bg-hover); }
.titlebar-btn.close:hover { background: #e81123; color: white; }

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary);
}
</style>
