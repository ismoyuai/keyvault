<template>
  <div class="dashboard">
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="page-title">{{ pageTitle }}</h2>
      </div>
      <div class="toolbar-right">
        <button class="btn-new" @click="showTemplateSelector = true">
          <Plus :size="16" />
          <span>新建</span>
        </button>
      </div>
    </div>

    <div v-if="auditResult && auditResult.score < 80" class="audit-banner" @click="showAudit = true">
      <AlertTriangle :size="16" />
      <span>安全评分: {{ auditResult.score }}/100 — 点击查看详情</span>
    </div>

    <div class="filter-bar">
      <button v-for="f in filters" :key="f.key" class="filter-chip"
              :class="{ active: activeFilter === f.key }"
              @click="setFilter(f.key)">
        <component :is="f.icon" :size="14" />
        <span>{{ f.label }}</span>
      </button>
    </div>

    <div class="entry-list" v-if="entriesStore.entries.length > 0">
      <EntryCard
        v-for="entry in entriesStore.entries" :key="entry.id"
        :entry="entry"
        :selected="selectedId === entry.id"
        @click="openEntry(entry.id)"
        @copy-password="copyPassword(entry)"
        @copy-username="copyUsername(entry)"
        @toggle-favorite="toggleFavorite(entry)"
        @contextmenu.prevent="showContext($event, entry)"
      />
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon"><Inbox :size="48" /></div>
      <div class="empty-text">{{ searchQuery ? '未找到匹配的条目' : '还没有任何条目' }}</div>
      <button v-if="!searchQuery" class="btn-new" @click="showTemplateSelector = true">
        添加第一个条目
      </button>
    </div>

    <TemplateSelector v-model="showTemplateSelector" @select="onTemplateSelect" />

    <el-dialog v-model="showAddDialog" :title="`新建${selectedTemplate?.name || '条目'}`" width="500px" :append-to-body="true">
      <el-form :model="newEntry" label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model="newEntry.title" placeholder="如: GitHub, OpenAI" />
        </el-form-item>
        <el-form-item v-for="field in templateFields" :key="field.key" :label="field.label" :required="field.required">
          <div v-if="field.type === 'password'" class="password-input-row">
            <el-input v-model="newEntry[field.key]" type="password" show-password />
            <el-button @click="newEntry[field.key] = generate()" size="small">🎲 生成</el-button>
          </div>
          <el-input v-else v-model="newEntry[field.key]" :placeholder="field.label" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="newEntry.notes" type="textarea" :rows="3" />
        </el-form-item>
        <template v-if="selectedTemplate?.customFieldPresets?.length">
          <div class="custom-fields-header">额外信息</div>
          <el-form-item v-for="preset in selectedTemplate.customFieldPresets" :key="preset.key" :label="preset.label">
            <el-input v-model="customFields[preset.key]" :type="preset.type === 'password' ? 'password' : 'text'" :show-password="preset.type === 'password'" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addEntry" :disabled="!newEntry.title">保存</el-button>
      </template>
    </el-dialog>

    <div v-if="contextMenu.show" class="context-menu" :style="contextMenuStyle" @click="contextMenu.show = false">
      <div class="ctx-item" @click="copyUsername(contextMenu.entry)"><User :size="14" /> 复制用户名</div>
      <div class="ctx-item" @click="copyPassword(contextMenu.entry)"><Key :size="14" /> 复制密码</div>
      <div class="ctx-item" @click="openEntry(contextMenu.entry.id)"><Edit :size="14" /> 编辑</div>
      <div class="ctx-item" @click="toggleFavorite(contextMenu.entry)"><Star :size="14" /> {{ contextMenu.entry.favorite ? '取消收藏' : '收藏' }}</div>
      <div class="ctx-separator"></div>
      <div class="ctx-item danger" @click="confirmDelete(contextMenu.entry)"><Trash2 :size="14" /> 删除</div>
    </div>

    <el-dialog v-model="showAudit" title="安全审计报告" width="600px" :append-to-body="true">
      <div v-if="auditResult" class="audit-report">
        <div class="audit-score">
          <div class="score-circle" :class="scoreLevel">{{ auditResult.score }}</div>
          <div class="score-label">安全评分</div>
        </div>
        <div v-if="auditResult.weak.length > 0" class="audit-section">
          <h4><AlertTriangle :size="14" /> 弱密码 ({{ auditResult.weak.length }})</h4>
          <div v-for="item in auditResult.weak" :key="item.id" class="audit-item">
            <span>{{ item.title }}</span><span class="audit-reason">{{ item.reason }}</span>
          </div>
        </div>
        <div v-if="auditResult.duplicate.length > 0" class="audit-section">
          <h4><Copy :size="14" /> 重复密码 ({{ auditResult.duplicate.length }})</h4>
          <div v-for="(item, i) in auditResult.duplicate" :key="i" class="audit-item">
            <span>{{ item.titles.join(' = ') }}</span>
          </div>
        </div>
        <div v-if="auditResult.old.length > 0" class="audit-section">
          <h4><Clock :size="14" /> 超过90天未更新 ({{ auditResult.old.length }})</h4>
          <div v-for="item in auditResult.old" :key="item.id" class="audit-item">
            <span>{{ item.title }}</span><span class="audit-reason">最后更新: {{ new Date(item.lastUpdated).toLocaleDateString('zh-CN') }}</span>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useEntriesStore } from '@/stores/entries'
import { useGroupsStore } from '@/stores/groups'
import { useClipboard } from '@/composables/useClipboard'
import { usePasswordGenerator } from '@/composables/usePasswordGenerator'
import { TEMPLATES } from '@/constants/templates'
import EntryCard from '@/components/EntryCard.vue'
import TemplateSelector from '@/components/TemplateSelector.vue'

const route = useRoute()
const router = useRouter()
const entriesStore = useEntriesStore()
const groupsStore = useGroupsStore()
const { copy: clipboardCopy } = useClipboard()
const { generate } = usePasswordGenerator()
const auditResult = ref(null)
const showAudit = ref(false)

const searchQuery = ref('')
const activeFilter = ref('all')
const showTemplateSelector = ref(false)
const showAddDialog = ref(false)
const selectedTemplateId = ref('password')
const selectedTemplate = computed(() => TEMPLATES[selectedTemplateId.value])
const selectedId = ref(null)
const contextMenu = ref({ show: false, x: 0, y: 0, entry: null })

const newEntry = ref({ title: '', username: '', password: '', url: '', notes: '' })
const customFields = ref({})

const templateFields = computed(() => selectedTemplate.value?.fields || [])

const pageTitle = computed(() => {
  if (route.query.favorites) return '⭐ 收藏'
  if (route.query.recent) return '🕐 最近使用'
  if (route.query.group) {
    const group = groupsStore.groups.find(g => g.id === route.query.group)
    return group ? `📁 ${group.name}` : '📁 分组'
  }
  return '全部条目'
})

const filters = [
  { key: 'all', label: '全部', icon: 'LayoutList' },
  { key: 'password', label: '密码', icon: 'Key' },
  { key: 'apikey', label: 'API Key', icon: 'Code' },
  { key: 'note', label: '笔记', icon: 'FileText' },
  { key: 'favorites', label: '收藏', icon: 'Star' },
]

const contextMenuStyle = computed(() => ({
  left: contextMenu.value.x + 'px',
  top: contextMenu.value.y + 'px',
}))

const scoreLevel = computed(() => {
  if (!auditResult.value) return ''
  const s = auditResult.value.score
  if (s >= 80) return 'good'
  if (s >= 60) return 'fair'
  return 'weak'
})

onMounted(async () => {
  // loadEntries 由下方 watch(route.query, {immediate:true}) 处理
  try { auditResult.value = await window.keyvault.audit.passwords() } catch {}
})

watch(() => route.query, (query) => {
  if (query.group) entriesStore.loadEntries({ group_id: query.group })
  else if (query.favorites) entriesStore.loadEntries({ favorites: true })
  else if (query.recent) entriesStore.loadEntries({ recent: true })
  else entriesStore.loadEntries()
}, { immediate: true })

function setFilter(key) {
  activeFilter.value = key
  if (key === 'all') entriesStore.loadEntries()
  else if (key === 'favorites') entriesStore.loadEntries({ favorites: true })
  else entriesStore.loadEntries({ type: key })
}

function onTemplateSelect(templateId) {
  selectedTemplateId.value = templateId
  newEntry.value = { title: '', username: '', password: '', url: '', notes: '' }
  customFields.value = {}
  showAddDialog.value = true
}

async function addEntry() {
  try {
    const data = { ...newEntry.value, type: selectedTemplateId.value, template_id: selectedTemplateId.value }
    const fields = []
    if (selectedTemplate.value?.customFieldPresets) {
      for (const preset of selectedTemplate.value.customFieldPresets) {
        if (customFields.value[preset.key]) {
          fields.push({ ...preset, value: customFields.value[preset.key] })
        }
      }
    }
    if (fields.length > 0) data.custom_fields = { fields }
    await entriesStore.addEntry(data)
    showAddDialog.value = false
    ElMessage.success('已保存')
  } catch (e) { ElMessage.error(e.message) }
}

function openEntry(id) { selectedId.value = id; router.push(`/app/entry/${id}`) }

async function copyPassword(entry) {
  const seconds = await clipboardCopy(entry.password, '密码')
  ElMessage.success(`密码已复制，${seconds}秒后自动清除`)
}

async function copyUsername(entry) {
  if (entry.username) {
    await window.keyvault.clipboard.copy(entry.username)
    ElMessage.success('用户名已复制')
  }
}

async function toggleFavorite(entry) { await entriesStore.updateEntry(entry.id, { favorite: !entry.favorite }) }

async function confirmDelete(entry) {
  try {
    await ElMessageBox.confirm('确定要删除这个条目吗？', '确认删除', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
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
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 18px; color: var(--text-primary); font-weight: 600; }
.btn-new {
  padding: 8px 16px; background: var(--accent); color: white; border: none;
  border-radius: 8px; font-size: 13px; cursor: pointer;
  display: flex; align-items: center; gap: 6px; transition: background 0.15s;
}
.btn-new:hover { background: var(--accent-hover); }
.filter-bar { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
.filter-chip {
  display: flex; align-items: center; gap: 6px; padding: 6px 14px;
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: 20px; color: var(--text-secondary); font-size: 13px;
  cursor: pointer; transition: all 0.15s;
}
.filter-chip:hover { border-color: var(--accent); color: var(--text-primary); }
.filter-chip.active { background: var(--accent); color: white; border-color: var(--accent); }
.entry-list { display: flex; flex-direction: column; gap: 4px; }
.empty-state { text-align: center; padding: 60px 20px; color: var(--text-secondary); }
.empty-icon { margin-bottom: 16px; color: var(--text-secondary); }
.empty-text { margin-bottom: 16px; }
.custom-fields-header {
  font-size: 13px; color: var(--text-secondary); margin: 16px 0 8px;
  padding-top: 16px; border-top: 1px solid var(--border);
}
.password-input-row { display: flex; gap: 8px; width: 100%; }
.password-input-row .el-input { flex: 1; }
.context-menu {
  position: fixed; background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: 8px; padding: 4px; min-width: 160px;
  box-shadow: 0 8px 24px var(--shadow); z-index: 9999;
}
.ctx-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  font-size: 13px; color: var(--text-primary); cursor: pointer; border-radius: 4px;
}
.ctx-item:hover { background: var(--bg-hover); }
.ctx-item.danger { color: var(--danger); }
.ctx-separator { height: 1px; background: var(--border); margin: 4px 0; }
.audit-banner {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px;
  background: rgba(230, 162, 60, 0.15); border: 1px solid var(--warning);
  border-radius: 8px; margin-bottom: 16px; cursor: pointer; font-size: 13px; color: var(--warning);
}
.audit-banner:hover { background: rgba(230, 162, 60, 0.25); }
.audit-report { padding: 8px; }
.audit-score { text-align: center; margin-bottom: 24px; }
.score-circle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 80px; height: 80px; border-radius: 50%; font-size: 28px;
  font-weight: bold; color: white; margin-bottom: 8px;
}
.score-circle.good { background: var(--success); }
.score-circle.fair { background: var(--warning); }
.score-circle.weak { background: var(--danger); }
.score-label { font-size: 14px; color: var(--text-secondary); }
.audit-section { margin-bottom: 16px; }
.audit-section h4 { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--text-primary); margin-bottom: 8px; }
.audit-item {
  display: flex; justify-content: space-between; padding: 8px 12px;
  background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 4px; font-size: 13px;
}
.audit-reason { color: var(--text-secondary); }
</style>
