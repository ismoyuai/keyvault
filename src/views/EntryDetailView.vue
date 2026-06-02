<template>
  <div class="entry-detail" v-if="entry">
    <div class="detail-header">
      <button class="back-btn" @click="$router.push('/app')">← 返回</button>
      <div class="header-actions">
        <button class="btn-icon" @click="toggleFavorite">{{ entry.favorite ? '⭐' : '☆' }}</button>
        <button class="btn-icon" @click="confirmDelete">🗑️</button>
      </div>
    </div>

    <div class="detail-card">
      <div class="card-icon">{{ typeIcon(entry.type) }}</div>
      <h2 class="card-title">{{ entry.title }}</h2>
      <span class="card-type">{{ typeName(entry.type) }}</span>
    </div>

    <div class="fields">
      <div class="field" v-if="entry.username">
        <label>用户名</label>
        <div class="field-value">
          <span>{{ entry.username }}</span>
          <button class="copy-btn" @click="copy('username', entry.username)">📋</button>
        </div>
      </div>

      <div class="field">
        <label>{{ entry.type === 'apikey' ? 'API Key' : '密码' }}</label>
        <div class="field-value">
          <span :class="{ masked: !showPassword }">
            {{ showPassword ? entry.password : '••••••••••••' }}
          </span>
          <button class="btn-icon-sm" @click="showPassword = !showPassword">
            {{ showPassword ? '🙈' : '👁️' }}
          </button>
          <button class="copy-btn" @click="copy('password', entry.password)">📋</button>
        </div>
      </div>

      <div class="field" v-if="entry.url">
        <label>网址</label>
        <div class="field-value">
          <a :href="entry.url" target="_blank" class="url-link">{{ entry.url }}</a>
          <button class="copy-btn" @click="copy('url', entry.url)">📋</button>
        </div>
      </div>

      <div class="field" v-if="entry.notes">
        <label>备注</label>
        <div class="field-value notes">{{ entry.notes }}</div>
      </div>

      <div class="field">
        <label>分组</label>
        <div class="field-value">{{ getGroupName(entry.group_id) }}</div>
      </div>

      <div class="field-meta">
        <span>创建: {{ formatDate(entry.created_at) }}</span>
        <span>更新: {{ formatDate(entry.updated_at) }}</span>
      </div>
    </div>

    <!-- 编辑模式 -->
    <div class="edit-section">
      <button class="btn-edit" @click="startEdit">✏️ 编辑</button>
    </div>

    <el-dialog v-model="editing" title="编辑条目" width="500px" :append-to-body="true">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="标题">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="editForm.username" />
        </el-form-item>
        <el-form-item :label="entry.type === 'apikey' ? 'API Key' : '密码'">
          <el-input v-model="editForm.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="网址">
          <el-input v-model="editForm.url" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.notes" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editing = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useEntriesStore } from '@/stores/entries'
import { useGroupsStore } from '@/stores/groups'

const route = useRoute()
const router = useRouter()
const entriesStore = useEntriesStore()
const groupsStore = useGroupsStore()
const entry = ref(null)
const showPassword = ref(false)
const editing = ref(false)
const editForm = ref({})

const typeIcons = { password: '🔑', apikey: '🤖', note: '📝' }
const typeNames = { password: '密码', apikey: 'API Key', note: '笔记' }
function typeIcon(t) { return typeIcons[t] || '📄' }
function typeName(t) { return typeNames[t] || '未知' }
function formatDate(d) { return d ? new Date(d).toLocaleString('zh-CN') : '' }

function getGroupName(groupId) {
  const group = groupsStore.groups.find(g => g.id === groupId)
  return group ? group.name : groupId
}

onMounted(async () => {
  try {
    entry.value = await entriesStore.loadEntry(route.params.id)
    await groupsStore.loadGroups()
  } catch (e) {
    ElMessage.error('加载失败')
    router.push('/app')
  }
})

async function copy(field, value) {
  await window.keyvault.clipboard.copy(value)
  ElMessage.success(`${field === 'password' ? '密码' : field === 'username' ? '用户名' : '链接'}已复制，30秒后清除`)
}

function startEdit() {
  editForm.value = { ...entry.value }
  editing.value = true
}

async function saveEdit() {
  try {
    await entriesStore.updateEntry(entry.value.id, editForm.value)
    entry.value = entriesStore.currentEntry
    editing.value = false
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function toggleFavorite() {
  await entriesStore.updateEntry(entry.value.id, { favorite: !entry.value.favorite })
  entry.value = entriesStore.currentEntry
}

async function confirmDelete() {
  try {
    await ElMessageBox.confirm('确定要删除这个条目吗？', '确认', { type: 'warning' })
    await entriesStore.deleteEntry(entry.value.id)
    router.push('/app')
    ElMessage.success('已删除')
  } catch {}
}
</script>

<style scoped>
.entry-detail { padding: 20px; max-width: 640px; }
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.back-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 14px;
  cursor: pointer;
}
.back-btn:hover { text-decoration: underline; }
.header-actions { display: flex; gap: 8px; }

.detail-card {
  text-align: center;
  padding: 24px;
  background: var(--bg-secondary);
  border-radius: 12px;
  margin-bottom: 20px;
}
.card-icon { font-size: 48px; margin-bottom: 8px; }
.card-title { font-size: 20px; color: var(--text-primary); margin-bottom: 4px; }
.card-type { font-size: 12px; color: var(--text-secondary); }

.fields { display: flex; flex-direction: column; gap: 16px; }
.field {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px 16px;
}
.field label {
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 6px;
}
.field-value {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
}
.field-value.masked { font-family: monospace; letter-spacing: 2px; }
.field-value.notes { white-space: pre-wrap; line-height: 1.6; }
.url-link { color: var(--accent); text-decoration: none; }
.url-link:hover { text-decoration: underline; }
.copy-btn, .btn-icon-sm {
  background: var(--bg-tertiary);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
}
.copy-btn:hover, .btn-icon-sm:hover { background: #333; }
.btn-icon {
  background: var(--bg-tertiary);
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 16px;
}
.btn-icon:hover { background: #333; }
.field-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px 0;
}
.edit-section { margin-top: 20px; text-align: center; }
.btn-edit {
  padding: 10px 24px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.btn-edit:hover { background: var(--accent-hover); }
</style>
