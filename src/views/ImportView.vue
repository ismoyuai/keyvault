<template>
  <div class="import-page">
    <h2 class="page-title">📥 导入数据</h2>

    <div class="import-tabs">
      <button v-for="tab in tabs" :key="tab.key" class="tab-btn"
              :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
        {{ tab.icon }} {{ tab.label }}
      </button>
    </div>

    <!-- 浏览器 CSV 导入 -->
    <div v-if="activeTab === 'browser'" class="import-section">
      <div class="section-desc">
        <p>支持 Chrome、Edge、Firefox 导出的 CSV 密码文件</p>
        <p class="tip">Chrome: 设置 → 密码 → 导出密码</p>
      </div>
      <div class="drop-zone" @click="selectCSVFile" @drop.prevent="onDrop" @dragover.prevent>
        <div class="drop-icon">📄</div>
        <div class="drop-text">点击选择 CSV 文件，或拖拽到此处</div>
      </div>
    </div>

    <!-- 文本导入 -->
    <div v-if="activeTab === 'text'" class="import-section">
      <div class="section-desc">
        <p>支持 KEY=VALUE、JSON、表格等多种格式</p>
        <p class="tip">每行一个，或粘贴结构化数据</p>
      </div>
      <textarea v-model="textContent" class="text-area" placeholder="OPENAI_KEY=sk-xxx&#10;GITHUB_TOKEN=ghp_xxx&#10;..."></textarea>
      <button class="btn-import" @click="importText" :disabled="!textContent.trim()">
        导入 ({{ textLineCount }} 条)
      </button>
    </div>

    <!-- 导入结果 -->
    <div v-if="result" class="import-result">
      <div class="result-icon">✅</div>
      <div class="result-text">
        成功导入 <strong>{{ result.imported }}</strong> 条记录
        <span v-if="result.total > result.imported">
          (共 {{ result.total }} 条，{{ result.total - result.imported }} 条重复已跳过)
        </span>
      </div>
    </div>

    <div v-if="error" class="import-error">❌ {{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('browser')
const textContent = ref('')
const result = ref(null)
const error = ref('')

const tabs = [
  { key: 'browser', label: '浏览器密码', icon: '🌐' },
  { key: 'text', label: '文本/API Key', icon: '📝' },
]

const textLineCount = computed(() =>
  textContent.value.trim().split('\n').filter(l => l.trim()).length
)

async function selectCSVFile() {
  const filePath = await window.keyvault.dialog.openFile({
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  })
  if (filePath) {
    await importCSV(filePath)
  }
}

function onDrop(event) {
  const file = event.dataTransfer.files[0]
  if (file && file.name.endsWith('.csv')) {
    importCSV(file.path)
  }
}

async function importCSV(filePath) {
  error.value = ''
  result.value = null
  try {
    result.value = await window.keyvault.import.browserCSV(filePath)
    ElMessage.success(`导入成功: ${result.value.imported} 条`)
  } catch (e) {
    error.value = e.message
  }
}

async function importText() {
  error.value = ''
  result.value = null
  try {
    result.value = await window.keyvault.import.text(textContent.value)
    ElMessage.success(`导入成功: ${result.value.imported} 条`)
    textContent.value = ''
  } catch (e) {
    error.value = e.message
  }
}
</script>

<style scoped>
.import-page { padding: 20px; max-width: 700px; }
.page-title { font-size: 20px; margin-bottom: 20px; color: var(--text-primary); }
.import-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.tab-btn {
  padding: 8px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
}
.tab-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
.import-section { background: var(--bg-secondary); border-radius: 12px; padding: 24px; }
.section-desc { margin-bottom: 16px; color: var(--text-secondary); font-size: 14px; }
.section-desc .tip { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

.drop-zone {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}
.drop-zone:hover { border-color: var(--accent); }
.drop-icon { font-size: 48px; margin-bottom: 12px; }
.drop-text { color: var(--text-secondary); }

.text-area {
  width: 100%;
  min-height: 200px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  padding: 12px;
  font-family: monospace;
  font-size: 13px;
  resize: vertical;
  outline: none;
}
.text-area:focus { border-color: var(--accent); }
.btn-import {
  margin-top: 12px;
  padding: 10px 24px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  width: 100%;
}
.btn-import:disabled { opacity: 0.5; cursor: not-allowed; }

.import-result {
  margin-top: 20px;
  background: rgba(103, 194, 58, 0.1);
  border: 1px solid rgba(103, 194, 58, 0.3);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.result-icon { font-size: 24px; }
.result-text { color: var(--text-primary); font-size: 14px; }
.import-error {
  margin-top: 16px;
  background: rgba(245, 108, 108, 0.1);
  border: 1px solid rgba(245, 108, 108, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--danger);
  font-size: 14px;
}
</style>
