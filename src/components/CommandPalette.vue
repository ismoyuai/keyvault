<template>
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="modelValue" class="palette-overlay" @click.self="close">
        <div class="palette-container">
          <div class="palette-input-row">
            <Search :size="16" />
            <input ref="inputRef" v-model="query" type="text"
                   placeholder="搜索条目..." class="palette-input"
                   @keydown.escape="close" @keydown.enter="selectFirst" />
          </div>
          <div class="palette-results" v-if="results.length > 0">
            <div v-for="entry in results" :key="entry.id"
                 class="palette-item" @click="openEntry(entry)">
              <div class="item-icon">
                <component :is="getIcon(entry)" :size="16" />
              </div>
              <div class="item-info">
                <div class="item-title">{{ entry.title }}</div>
                <div class="item-subtitle">{{ entry.username || entry.url }}</div>
              </div>
              <div class="item-actions">
                <button class="item-action" @click.stop="copyPassword(entry)" title="复制密码">
                  <Copy :size="14" />
                </button>
              </div>
            </div>
          </div>
          <div v-else-if="query" class="palette-empty">未找到匹配的条目</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useEntriesStore } from '@/stores/entries'
import { TEMPLATES } from '@/constants/templates'
import { useClipboard } from '@/composables/useClipboard'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const entriesStore = useEntriesStore()
const { copy: clipboardCopy } = useClipboard()
const query = ref('')
const results = ref([])
const inputRef = ref(null)

watch(() => props.modelValue, async (val) => {
  if (val) {
    query.value = ''
    results.value = []
    await nextTick()
    inputRef.value?.focus()
  }
})

watch(query, async (q) => {
  if (!q.trim()) { results.value = []; return }
  results.value = await entriesStore.searchEntries(q)
})

function getIcon(entry) {
  const template = TEMPLATES[entry.template_id || entry.type]
  return template ? template.icon : 'File'
}

function openEntry(entry) { router.push(`/app/entry/${entry.id}`); close() }

async function copyPassword(entry) {
  await clipboardCopy(entry.password, '密码')
  ElMessage.success('密码已复制')
  close()
}

function selectFirst() { if (results.value.length > 0) openEntry(results.value[0]) }
function close() { emit('update:modelValue', false) }
</script>

<style scoped>
.palette-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
  z-index: 10000; display: flex; justify-content: center; padding-top: 15vh;
}
.palette-container {
  width: 520px; max-height: 400px; background: var(--bg-secondary);
  border: 1px solid var(--border); border-radius: 12px;
  box-shadow: 0 16px 48px var(--shadow); overflow: hidden;
  display: flex; flex-direction: column;
}
.palette-input-row {
  display: flex; align-items: center; gap: 12px; padding: 16px;
  border-bottom: 1px solid var(--border); color: var(--text-secondary);
}
.palette-input {
  flex: 1; background: transparent; border: none; color: var(--text-primary);
  font-size: 15px; outline: none;
}
.palette-input::placeholder { color: var(--text-secondary); }
.palette-results { overflow-y: auto; padding: 8px; }
.palette-item {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border-radius: 8px; cursor: pointer; transition: background 0.1s;
}
.palette-item:hover { background: var(--bg-hover); }
.item-icon {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-tertiary); border-radius: 8px; color: var(--accent);
}
.item-info { flex: 1; min-width: 0; }
.item-title { font-size: 14px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-subtitle { font-size: 12px; color: var(--text-secondary); }
.item-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.1s; }
.palette-item:hover .item-actions { opacity: 1; }
.item-action {
  width: 28px; height: 28px; border: none; background: var(--bg-tertiary);
  border-radius: 6px; cursor: pointer; color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
}
.item-action:hover { background: var(--accent); color: white; }
.palette-empty { padding: 24px; text-align: center; color: var(--text-secondary); font-size: 14px; }
.palette-enter-active, .palette-leave-active { transition: opacity 0.15s; }
.palette-enter-from, .palette-leave-to { opacity: 0; }
</style>
