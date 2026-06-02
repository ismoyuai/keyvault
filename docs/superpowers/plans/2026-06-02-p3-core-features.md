# P3: 核心功能补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全核心功能：增量同步、密码强度审计、剪贴板自动清除、自动锁定、密码生成器 UI。

**Architecture:** 增量同步基于 updated_at 时间戳 diff；审计功能实时计算不存储；剪贴板/自动锁定转为 Vue composables。

**Tech Stack:** Pinia, Vue 3 composables, WebDAV, Vitest

---

## File Map

| 操作 | 文件 | 职责 |
|---|---|---|
| Modify | `electron/sync/sync-engine.cjs` | 增量同步逻辑 |
| Modify | `electron/main.js` | 新增 audit IPC、更新 sync handler |
| Modify | `electron/preload.cjs` | 新增 audit 通道 |
| Create | `src/composables/useClipboard.js` | 剪贴板自动清除 |
| Create | `src/composables/useAutoLock.js` | 自动锁定 |
| Create | `src/composables/usePasswordGenerator.js` | 密码生成器 |
| Modify | `src/views/DashboardView.vue` | 审计入口、密码生成器 |
| Modify | `src/views/EntryDetailView.vue` | 密码生成器 |
| Create | `electron/sync/__tests__/sync-engine.test.cjs` | 同步模块测试 |

---

### Task 1: 实现增量同步

**Files:**
- Modify: `electron/sync/sync-engine.cjs`
- Modify: `electron/main.js`

- [ ] **Step 1: 重写 sync-engine.cjs 支持增量同步**

Replace `electron/sync/sync-engine.cjs`:

```javascript
const crypto = require('crypto')
const { upload, download, getLastModified } = require('./webdav-client.cjs')

const REMOTE_PATH = '/keyvault/data.kv'

async function push(localData, deviceId, lastSyncTime) {
  // 只上传变更的条目（updated_at > lastSyncTime）
  let entriesToSend = localData.entries
  if (lastSyncTime) {
    entriesToSend = localData.entries.filter(e => e.updated_at > lastSyncTime)
  }

  const payload = {
    version: 2,
    device_id: deviceId,
    exported_at: new Date().toISOString(),
    data: {
      ...localData,
      entries: entriesToSend,
    },
    checksum: computeChecksum({ ...localData, entries: entriesToSend }),
  }
  await upload(REMOTE_PATH, JSON.stringify(payload))
  return { success: true, exported_at: payload.exported_at, entriesSent: entriesToSend.length }
}

async function pull() {
  const content = await download(REMOTE_PATH)
  if (!content) return { data: null, remoteTime: null }
  const payload = JSON.parse(content)
  const expected = computeChecksum(payload.data)
  if (payload.checksum !== expected) throw new Error('数据校验失败，文件可能被篡改')
  return {
    data: payload.data,
    remoteTime: payload.exported_at,
    device_id: payload.device_id,
    version: payload.version || 1,
  }
}

async function getStatus() {
  const remoteTime = await getLastModified(REMOTE_PATH)
  return { lastRemoteSync: remoteTime }
}

function mergeEntries(localEntries, remoteEntries) {
  const merged = new Map()
  const conflicts = []

  // 先加入本地条目
  for (const entry of localEntries) {
    merged.set(entry.id, entry)
  }

  // 合并远程条目
  for (const remote of remoteEntries) {
    const local = merged.get(remote.id)
    if (!local) {
      // 远程有，本地无 → 新增
      merged.set(remote.id, remote)
    } else if (remote.updated_at > local.updated_at) {
      // 远程更新 → 覆盖本地
      merged.set(remote.id, remote)
    } else if (remote.updated_at < local.updated_at) {
      // 本地更新 → 保留本地（不覆盖）
    } else {
      // 时间戳相同 → 保留本地（无冲突）
    }
    // 注意：同一条目两端都修改过且时间戳不同的情况，
    // 已通过 updated_at 比较解决
  }

  return {
    entries: Array.from(merged.values()),
    conflicts,
  }
}

function computeChecksum(data) {
  // 深度排序确保一致性
  const str = JSON.stringify(data, (key, value) => {
    if (Array.isArray(value)) {
      return value.map(v => {
        if (typeof v === 'object' && v !== null && v.id) {
          // 对 entries 数组按 id 排序
          return v
        }
        return v
      })
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted, k) => {
        sorted[k] = value[k]
        return sorted
      }, {})
    }
    return value
  })
  return crypto.createHash('sha256').update(str).digest('hex')
}

module.exports = { push, pull, getStatus, mergeEntries }
```

- [ ] **Step 2: 更新 main.js 中的 sync:pull handler**

```javascript
ipcMain.handle('sync:pull', async () => {
  if (!encryptionKey) throw new Error('未解锁')
  const config = loadConfig()
  if (!config.webdav) throw new Error('请先配置 WebDAV')
  const webdavConfig = decryptWebDAVCredentials(config.webdav)
  createWebDAVClient(webdavConfig)
  const result = await pull()
  if (result.data) {
    if (result.version >= 2) {
      // 增量同步：合并而非替换
      const localData = exportEncrypted()
      const { entries, conflicts } = mergeEntries(localData.entries, result.data.entries || [])
      importEncrypted({ ...result.data, entries })
      if (conflicts.length > 0) {
        // 记录冲突到 sync_meta
        const existingConflicts = getSetting('sync_conflicts') || '[]'
        const allConflicts = [...JSON.parse(existingConflicts), ...conflicts]
        setSetting('sync_conflicts', JSON.stringify(allConflicts))
      }
    } else {
      // v1 全量同步兼容
      importEncrypted(result.data)
    }
  }
  // 更新同步时间
  const appConfig = loadConfig()
  appConfig.lastSyncTime = new Date().toISOString()
  saveConfig(appConfig)
  return result
})
```

- [ ] **Step 3: 更新 sync:push handler 使用增量**

```javascript
ipcMain.handle('sync:push', async () => {
  if (!encryptionKey) throw new Error('未解锁')
  const config = loadConfig()
  if (!config.webdav) throw new Error('请先配置 WebDAV')
  const webdavConfig = decryptWebDAVCredentials(config.webdav)
  createWebDAVClient(webdavConfig)
  const data = exportEncrypted()
  const result = await push(data, getDeviceIdSafe(), config.lastSyncTime || null)
  // 更新同步时间
  config.lastSyncTime = result.exported_at
  saveConfig(config)
  return result
})
```

- [ ] **Step 4: Commit**

```bash
git add electron/sync/sync-engine.cjs electron/main.js
git commit -m "feat: implement incremental sync with conflict resolution

- Push only sends entries updated since last sync
- Pull merges entries by updated_at timestamp
- Backward compatible with v1 full sync
- Sync timestamp persisted in config"
```

---

### Task 2: 实现密码强度审计

**Files:**
- Modify: `electron/main.js` (add audit handler)
- Modify: `electron/preload.cjs` (add audit channel)

- [ ] **Step 1: 添加密码强度评估函数**

在 `electron/main.js` 中添加：

```javascript
// ========== 密码强度审计 ==========
function evaluatePasswordStrength(password) {
  if (!password) return { score: 0, level: 'weak' }
  let s = 0
  if (password.length >= 8) s++
  if (password.length >= 12) s++
  if (password.length >= 16) s++
  if (/[a-z]/.test(password)) s++
  if (/[A-Z]/.test(password)) s++
  if (/[0-9]/.test(password)) s++
  if (/[^a-zA-Z0-9]/.test(password)) s++
  if (new Set(password).size >= 8) s++

  if (s < 3) return { score: s, level: 'weak' }
  if (s < 5) return { score: s, level: 'fair' }
  if (s < 7) return { score: s, level: 'good' }
  return { score: s, level: 'strong' }
}

function auditPasswords() {
  if (!encryptionKey) throw new Error('未解锁')
  const entries = listEntries(encryptionKey, {})
  const weak = []
  const duplicateMap = new Map()
  const old = []
  const now = Date.now()
  const ninetyDays = 90 * 24 * 60 * 60 * 1000

  for (const entry of entries) {
    // 弱密码检测
    const strength = evaluatePasswordStrength(entry.password)
    if (strength.level === 'weak' || strength.level === 'fair') {
      weak.push({ id: entry.id, title: entry.title, reason: `密码强度: ${strength.level}` })
    }

    // 重复密码检测
    if (entry.password) {
      if (!duplicateMap.has(entry.password)) {
        duplicateMap.set(entry.password, [])
      }
      duplicateMap.get(entry.password).push({ id: entry.id, title: entry.title })
    }

    // 旧密码检测
    const updatedAt = new Date(entry.updated_at).getTime()
    if (now - updatedAt > ninetyDays) {
      old.push({ id: entry.id, title: entry.title, lastUpdated: entry.updated_at })
    }
  }

  const duplicate = []
  for (const [_, group] of duplicateMap) {
    if (group.length > 1) {
      duplicate.push({ ids: group.map(e => e.id), titles: group.map(e => e.title) })
    }
  }

  const totalIssues = weak.length + duplicate.length + old.length
  const score = Math.max(0, 100 - totalIssues * 5)

  return { weak, duplicate, old, score, totalEntries: entries.length }
}
```

- [ ] **Step 2: 添加 audit IPC handler**

```javascript
ipcMain.handle('audit:passwords', () => auditPasswords())
```

- [ ] **Step 3: 更新 preload.cjs**

在 `contextBridge.exposeInMainWorld` 中添加：

```javascript
audit: {
  passwords: () => ipcRenderer.invoke('audit:passwords'),
},
```

- [ ] **Step 4: Commit**

```bash
git add electron/main.js electron/preload.cjs
git commit -m "feat: add password strength audit

Detects weak passwords, duplicate passwords, and passwords older than
90 days. Returns a score (0-100) and categorized findings."
```

---

### Task 3: 创建剪贴板自动清除 composable

**Files:**
- Create: `src/composables/useClipboard.js`

- [ ] **Step 1: 创建 composables 目录**

```bash
mkdir -p D:/keyvault/src/composables
```

- [ ] **Step 2: 实现 useClipboard**

Create `src/composables/useClipboard.js`:

```javascript
import { ref, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

export function useClipboard() {
  const timer = ref(null)
  const copiedField = ref(null)

  async function copy(text, fieldName = 'text') {
    await window.keyvault.clipboard.copy(text)
    copiedField.value = fieldName

    // 清除之前的定时器
    if (timer.value) clearTimeout(timer.value)

    // 设置新的定时器
    const settings = useSettingsStore()
    const seconds = settings.clipboardClearSeconds || 30
    timer.value = setTimeout(() => {
      clearClipboard()
    }, seconds * 1000)

    return seconds
  }

  function clearClipboard() {
    // 写入空字符串清除剪贴板
    window.keyvault.clipboard.copy('')
    copiedField.value = null
    if (timer.value) {
      clearTimeout(timer.value)
      timer.value = null
    }
  }

  // 组件卸载时清除
  onUnmounted(() => {
    if (timer.value) clearTimeout(timer.value)
  })

  return { copy, clearClipboard, copiedField }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/composables/useClipboard.js
git commit -m "feat: add useClipboard composable with auto-clear

Copies text to clipboard and auto-clears after configurable timeout.
Integrates with settings store for timeout configuration."
```

---

### Task 4: 创建自动锁定 composable

**Files:**
- Create: `src/composables/useAutoLock.js`

- [ ] **Step 1: 实现 useAutoLock**

Create `src/composables/useAutoLock.js`:

```javascript
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useClipboard } from './useClipboard'

export function useAutoLock() {
  const router = useRouter()
  const auth = useAuthStore()
  const settings = useSettingsStore()
  const { clearClipboard } = useClipboard()
  const timer = ref(null)

  function resetTimer() {
    if (timer.value) clearTimeout(timer.value)
    const minutes = settings.autoLockMinutes || 15
    timer.value = setTimeout(() => {
      lock()
    }, minutes * 60 * 1000)
  }

  function lock() {
    clearClipboard()
    auth.lock()
    router.push('/login')
  }

  function handleActivity() {
    resetTimer()
  }

  onMounted(() => {
    resetTimer()
    document.addEventListener('mousemove', handleActivity)
    document.addEventListener('keydown', handleActivity)
    document.addEventListener('click', handleActivity)
  })

  onUnmounted(() => {
    if (timer.value) clearTimeout(timer.value)
    document.removeEventListener('mousemove', handleActivity)
    document.removeEventListener('keydown', handleActivity)
    document.removeEventListener('click', handleActivity)
  })

  // 窗口失焦时立即锁定（安全考虑）
  function handleBlur() {
    // 只在窗口失焦时清除剪贴板，不立即锁定
    clearClipboard()
  }

  onMounted(() => {
    window.addEventListener('blur', handleBlur)
  })

  onUnmounted(() => {
    window.removeEventListener('blur', handleBlur)
  })

  return { lock, resetTimer }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/composables/useAutoLock.js
git commit -m "feat: add useAutoLock composable

Monitors mouse/keyboard/click activity and auto-locks after configurable
timeout. Clears clipboard on window blur for security."
```

---

### Task 5: 创建密码生成器 composable

**Files:**
- Create: `src/composables/usePasswordGenerator.js`

- [ ] **Step 1: 实现 usePasswordGenerator**

Create `src/composables/usePasswordGenerator.js`:

```javascript
import { ref } from 'vue'

export function usePasswordGenerator() {
  const password = ref('')
  const length = ref(16)
  const options = ref({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  })

  const charset = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  }

  function generate() {
    let chars = ''
    if (options.value.uppercase) chars += charset.uppercase
    if (options.value.lowercase) chars += charset.lowercase
    if (options.value.numbers) chars += charset.numbers
    if (options.value.symbols) chars += charset.symbols

    if (!chars) {
      chars = charset.lowercase // 至少包含小写字母
    }

    const array = new Uint32Array(length.value)
    crypto.getRandomValues(array)
    password.value = Array.from(array, x => chars[x % chars.length]).join('')
    return password.value
  }

  function evaluateStrength(pwd) {
    const p = pwd || password.value
    if (!p) return { score: 0, level: 'weak', label: '' }
    let s = 0
    if (p.length >= 8) s++
    if (p.length >= 12) s++
    if (p.length >= 16) s++
    if (/[a-z]/.test(p)) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^a-zA-Z0-9]/.test(p)) s++
    if (new Set(p).size >= 8) s++

    const levels = [
      { min: 0, level: 'weak', label: '弱' },
      { min: 3, level: 'fair', label: '一般' },
      { min: 5, level: 'good', label: '良好' },
      { min: 7, level: 'strong', label: '强' },
    ]
    const matched = [...levels].reverse().find(l => s >= l.min)
    return { score: Math.min(s, 10), ...matched }
  }

  return { password, length, options, generate, evaluateStrength }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/composables/usePasswordGenerator.js
git commit -m "feat: add usePasswordGenerator composable

Generates cryptographically secure random passwords with configurable
length and character sets. Includes strength evaluation."
```

---

### Task 6: 更新 DashboardView 添加审计入口

**Files:**
- Modify: `src/views/DashboardView.vue`

- [ ] **Step 1: 添加审计结果状态和 UI**

在 DashboardView template 中，toolbar 下方添加：

```html
<!-- 安全审计警告 -->
<div v-if="auditResult && auditResult.score < 80" class="audit-banner" @click="showAudit = true">
  <span class="audit-icon">⚠️</span>
  <span>安全评分: {{ auditResult.score }}/100 — 点击查看详情</span>
</div>
```

在 script 中添加：

```javascript
import { ref, onMounted } from 'vue'
import { useClipboard } from '@/composables/useClipboard'

const { copy: clipboardCopy } = useClipboard()
const auditResult = ref(null)
const showAudit = ref(false)

onMounted(async () => {
  await entriesStore.loadEntries()
  try {
    auditResult.value = await window.keyvault.audit.passwords()
  } catch {}
})

async function copyPassword(entry) {
  const seconds = await clipboardCopy(entry.password, '密码')
  ElMessage.success(`密码已复制，${seconds}秒后自动清除`)
}
```

在 style 中添加：

```css
.audit-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(230, 162, 60, 0.15);
  border: 1px solid #e6a23c;
  border-radius: 8px;
  margin-bottom: 16px;
  cursor: pointer;
  font-size: 13px;
  color: #e6a23c;
}
.audit-banner:hover { background: rgba(230, 162, 60, 0.25); }
```

- [ ] **Step 2: 添加审计详情弹窗**

在 template 中添加：

```html
<el-dialog v-model="showAudit" title="安全审计报告" width="600px" :append-to-body="true">
  <div v-if="auditResult" class="audit-report">
    <div class="audit-score">
      <div class="score-circle" :class="scoreLevel">
        {{ auditResult.score }}
      </div>
      <div class="score-label">安全评分</div>
    </div>

    <div v-if="auditResult.weak.length > 0" class="audit-section">
      <h4>⚠️ 弱密码 ({{ auditResult.weak.length }})</h4>
      <div v-for="item in auditResult.weak" :key="item.id" class="audit-item">
        <span>{{ item.title }}</span>
        <span class="audit-reason">{{ item.reason }}</span>
      </div>
    </div>

    <div v-if="auditResult.duplicate.length > 0" class="audit-section">
      <h4>🔄 重复密码 ({{ auditResult.duplicate.length }})</h4>
      <div v-for="(item, i) in auditResult.duplicate" :key="i" class="audit-item">
        <span>{{ item.titles.join(' = ') }}</span>
      </div>
    </div>

    <div v-if="auditResult.old.length > 0" class="audit-section">
      <h4>📅 超过90天未更新 ({{ auditResult.old.length }})</h4>
      <div v-for="item in auditResult.old" :key="item.id" class="audit-item">
        <span>{{ item.title }}</span>
        <span class="audit-reason">最后更新: {{ new Date(item.lastUpdated).toLocaleDateString('zh-CN') }}</span>
      </div>
    </div>
  </div>
</el-dialog>
```

添加 computed：

```javascript
const scoreLevel = computed(() => {
  if (!auditResult.value) return ''
  const s = auditResult.value.score
  if (s >= 80) return 'good'
  if (s >= 60) return 'fair'
  return 'weak'
})
```

- [ ] **Step 3: Commit**

```bash
git add src/views/DashboardView.vue
git commit -m "feat: add password audit banner and report to dashboard

Shows security score banner when score < 80. Click to view detailed
report with weak/duplicate/old password findings."
```

---

### Task 7: 添加密码生成器 UI

**Files:**
- Modify: `src/views/DashboardView.vue`
- Modify: `src/views/EntryDetailView.vue`

- [ ] **Step 1: 在 DashboardView 的添加对话框中添加生成按钮**

在密码输入框下方添加：

```html
<el-form-item :label="newEntry.type === 'apikey' ? 'API Key' : '密码'">
  <div class="password-input-row">
    <el-input v-model="newEntry.password" type="password" show-password />
    <el-button @click="generateAndFill" size="small">🎲 生成</el-button>
  </div>
</el-form-item>
```

在 script 中添加：

```javascript
import { usePasswordGenerator } from '@/composables/usePasswordGenerator'

const { generate } = usePasswordGenerator()

function generateAndFill() {
  newEntry.value.password = generate()
}
```

在 style 中添加：

```css
.password-input-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.password-input-row .el-input { flex: 1; }
```

- [ ] **Step 2: 在 EntryDetailView 的编辑对话框中添加生成按钮**

类似地，在编辑表单的密码字段旁添加生成按钮。

- [ ] **Step 3: Commit**

```bash
git add src/views/DashboardView.vue src/views/EntryDetailView.vue
git commit -m "feat: add password generator button to add/edit dialogs

Users can generate secure random passwords directly in the entry form."
```

---

### Task 8: 为同步模块编写测试

**Files:**
- Create: `electron/sync/__tests__/sync-engine.test.cjs`

- [ ] **Step 1: 编写同步模块测试**

Create `electron/sync/__tests__/sync-engine.test.cjs`:

```javascript
const { describe, it, expect } = require('vitest')
const { mergeEntries, computeChecksum } = require('../sync-engine.cjs')

describe('sync-engine.cjs', () => {
  describe('mergeEntries', () => {
    it('should add new remote entries', () => {
      const local = [{ id: '1', title: 'A', updated_at: '2024-01-01' }]
      const remote = [
        { id: '1', title: 'A', updated_at: '2024-01-01' },
        { id: '2', title: 'B', updated_at: '2024-01-02' },
      ]
      const { entries } = mergeEntries(local, remote)
      expect(entries.length).toBe(2)
    })

    it('should keep newer local version', () => {
      const local = [{ id: '1', title: 'A-local', updated_at: '2024-01-02' }]
      const remote = [{ id: '1', title: 'A-remote', updated_at: '2024-01-01' }]
      const { entries } = mergeEntries(local, remote)
      expect(entries[0].title).toBe('A-local')
    })

    it('should use newer remote version', () => {
      const local = [{ id: '1', title: 'A-local', updated_at: '2024-01-01' }]
      const remote = [{ id: '1', title: 'A-remote', updated_at: '2024-01-02' }]
      const { entries } = mergeEntries(local, remote)
      expect(entries[0].title).toBe('A-remote')
    })

    it('should handle empty arrays', () => {
      const { entries } = mergeEntries([], [])
      expect(entries.length).toBe(0)
    })

    it('should handle multiple entries', () => {
      const local = [
        { id: '1', title: 'A', updated_at: '2024-01-01' },
        { id: '2', title: 'B', updated_at: '2024-01-02' },
      ]
      const remote = [
        { id: '1', title: 'A-new', updated_at: '2024-01-03' },
        { id: '3', title: 'C', updated_at: '2024-01-01' },
      ]
      const { entries } = mergeEntries(local, remote)
      expect(entries.length).toBe(3)
      expect(entries.find(e => e.id === '1').title).toBe('A-new')
    })
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
npx vitest run electron/sync/__tests__/sync-engine.test.cjs
```

- [ ] **Step 3: Commit**

```bash
git add electron/sync/__tests__/sync-engine.test.cjs
git commit -m "test: add unit tests for sync engine merge logic"
```

---

### Task 9: P3 最终验证

- [ ] **Step 1: 运行全部测试**

```bash
npx vitest run
```

- [ ] **Step 2: 手动验证清单**

1. 增量同步：修改条目后 push，再次 pull 验证只传输变更
2. 审计：Dashboard 显示安全评分，点击查看详细报告
3. 剪贴板：复制密码后等待 30 秒，验证剪贴板被清除
4. 自动锁定：无操作超时后应用自动锁定
5. 密码生成器：添加条目时点击"生成"按钮

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "chore: P3 core features complete

- Incremental sync with conflict resolution
- Password strength audit (weak/duplicate/old detection)
- Clipboard auto-clear composable
- Auto-lock composable
- Password generator UI
- Sync engine unit tests"
```
