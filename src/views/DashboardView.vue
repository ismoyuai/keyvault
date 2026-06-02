<template>
  <div class="dashboard">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索条目..."
          class="search-input"
          @input="onSearch"
        />
      </div>
      <div class="toolbar-actions">
        <button class="btn-add" @click="showAddDialog = true">
          <span>+</span> 新建
        </button>
      </div>
    </div>

    <!-- 条目类型筛选 -->
    <div class="filter-bar">
      <button v-for="f in filters" :key="f.key" class="filter-chip"
              :class="{ active: activeFilter === f.key }"
              @click="setFilter(f.key)">
        {{ f.icon }} {{ f.label }}
      </button>
    </div>

    <!-- 条目列表 -->
    <div class="entry-list" v-if="entriesStore.entries.length > 0">
      <div v-for="entry in entriesStore.entries" :key="entry.id" class="entry-card"
           @click="openEntry(entry.id)" @contextmenu.prevent="showContext($event, entry)">
        <div class="entry-icon">{{ typeIcon(entry.type) }}</div>
        <div class="entry-info">
          <div class="entry-title">{{ entry.title }}</div>
          <div class="entry-meta">
            <span v-if="entry.username" class="meta-user">{{ entry.username }}</span>
            <span class="meta-url">{{ entry.url }}</span>
          </div>
        </div>
        <div class="entry-actions">
          <button class="action-btn" @click.stop="copyPassword(entry)" title="复制密码">📋</button>
          <button class="action-btn" @click.stop="toggleFavorite(entry)" title="收藏">
            {{ entry.favorite ? '⭐' : '☆' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-text">{{ searchQuery ? '未找到匹配的条目' : '还没有任何条目' }}</div>
      <button v-if="!searchQuery" class="btn-add" @click="showAddDialog = true">
        添加第一个条目
      </button>
    </div>

    <!-- 新建条目对话框 -->
    <el-dialog v-model="showAddDialog" title="新建条目" width="500px" :append-to-body="true">
      <el-form :model="newEntry" label-position="top">
        <el-form-item label="类型">
          <el-radio-group v-model="newEntry.type">
            <el-radio-button value="password">密码</el-radio-button>
            <el-radio-button value="apikey">API Key</el-radio-button>
            <el-radio-button value="note">笔记</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="newEntry.title" placeholder="如: OpenAI, GitHub" />
        </el-form-item>
        <el-form-item v-if="newEntry.type !== 'note'" label="用户名">
          <el-input v-model="newEntry.username" placeholder="邮箱或用户名" />
        </el-form-item>
        <el-form-item :label="newEntry.type === 'apikey' ? 'API Key' : '密码'">
          <el-input v-model="newEntry.password" type="password" show-password />
        </el-form-item>
        <el-form-item v-if="newEntry.type !== 'apikey'" label="网址">
          <el-input v-model="newEntry.url" placeholder="https://" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="newEntry.notes" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addEntry" :disabled="!newEntry.title || !newEntry.password">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 右键菜单 -->
    <div v-if="contextMenu.show" class="context-menu" :style="contextMenuStyle"
         @click="contextMenu.show = false">
      <div class="ctx-item" @click="copyUsername(contextMenu.entry)">📋 复制用户名</div>
      <div class="ctx-item" @click="copyPassword(contextMenu.entry)">🔑 复制密码</div>
      <div class="ctx-item" @click="openEntry(contextMenu.entry.id)">✏️ 编辑</div>
      <div class="ctx-item" @click="toggleFavorite(contextMenu.entry)">
        {{ contextMenu.entry.favorite ? '取消收藏' : '⭐ 收藏' }}
      </div>
      <div class="ctx-separator"></div>
      <div class="ctx-item danger" @click="confirmDelete(contextMenu.entry)">🗑️ 删除</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useEntriesStore } from '@/stores/entries'

const route = useRoute()
const router = useRouter()
const entriesStore = useEntriesStore()

const searchQuery = ref('')
const activeFilter = ref('all')
const showAddDialog = ref(false)
const contextMenu = ref({ show: false, x: 0, y: 0, entry: null })

const newEntry = ref({
  type: 'password',
  title: '',
  username: '',
  password: '',
  url: '',
  notes: '',
})

const filters = [
  { key: 'all', label: '全部', icon: '📋' },
  { key: 'password', label: '密码', icon: '🔑' },
  { key: 'apikey', label: 'API Key', icon: '🤖' },
  { key: 'note', label: '笔记', icon: '📝' },
  { key: 'favorites', label: '收藏', icon: '⭐' },
]

const typeIcons = { password: '🔑', apikey: '🤖', note: '📝' }
function typeIcon(type) { return typeIcons[type] || '📄' }

const contextMenuStyle = computed(() => ({
  left: contextMenu.value.x + 'px',
  top: contextMenu.value.y + 'px',
}))

onMounted(() => entriesStore.loadEntries())

watch(() => route.query, () => {
  if (route.query.group) {
    entriesStore.loadEntries({ group_id: route.query.group })
  }
})

function setFilter(key) {
  activeFilter.value = key
  if (key === 'all') entriesStore.loadEntries()
  else if (key === 'favorites') entriesStore.loadEntries({ favorites: true })
  else entriesStore.loadEntries({ type: key })
}

let searchTimer = null
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (searchQuery.value.trim()) {
      await entriesStore.searchEntries(searchQuery.value)
    } else {
      entriesStore.loadEntries()
    }
  }, 300)
}

async function addEntry() {
  try {
    await entriesStore.addEntry(newEntry.value)
    showAddDialog.value = false
    newEntry.value = { type: 'password', title: '', username: '', password: '', url: '', notes: '' }
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function openEntry(id) {
  router.push(`/app/entry/${id}`)
}

async function copyPassword(entry) {
  await window.keyvault.clipboard.copy(entry.password)
  ElMessage.success('密码已复制，30秒后自动清除')
}

async function copyUsername(entry) {
  if (entry.username) {
    await window.keyvault.clipboard.copy(entry.username)
    ElMessage.success('用户名已复制')
  }
}

async function toggleFavorite(entry) {
  await entriesStore.updateEntry(entry.id, { favorite: !entry.favorite })
}

async function confirmDelete(entry) {
  try {
    await ElMessageBox.confirm('确定要删除这个条目吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await entriesStore.deleteEntry(entry.id)
    ElMessage.success('已删除')
  } catch {}
}

function showContext(event, entry) {
  contextMenu.value = { show: true, x: event.clientX, y: event.clientY, entry }
  document.addEventListener('click', () => { contextMenu.value.show = false }, { once: true })
}
</script>

<style scoped>
.dashboard { padding: 20px; }

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 12px;
}
.search-icon { font-size: 16px; margin-right: 8px; }
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: 10px 0;
  font-size: 14px;
  outline: none;
}
.btn-add {
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.btn-add:hover { background: var(--accent-hover); }

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.filter-chip {
  padding: 6px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.filter-chip:hover { border-color: var(--accent); color: var(--text-primary); }
.filter-chip.active { background: var(--accent); color: white; border-color: var(--accent); }

.entry-list { display: flex; flex-direction: column; gap: 2px; }
.entry-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.entry-card:hover { background: var(--bg-hover); }
.entry-icon { font-size: 24px; width: 36px; text-align: center; }
.entry-info { flex: 1; min-width: 0; }
.entry-title { font-size: 14px; color: var(--text-primary); font-weight: 500; }
.entry-meta { font-size: 12px; color: var(--text-secondary); margin-top: 2px; display: flex; gap: 8px; }
.meta-user { color: var(--accent); }
.meta-url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.entry-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.entry-card:hover .entry-actions { opacity: 1; }
.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-tertiary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.action-btn:hover { background: #333; }

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-text { margin-bottom: 16px; }

.context-menu {
  position: fixed;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  min-width: 160px;
  box-shadow: 0 8px 24px var(--shadow);
  z-index: 9999;
}
.ctx-item {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 4px;
}
.ctx-item:hover { background: var(--bg-hover); }
.ctx-item.danger { color: var(--danger); }
.ctx-separator { height: 1px; background: var(--border); margin: 4px 0; }
</style>
