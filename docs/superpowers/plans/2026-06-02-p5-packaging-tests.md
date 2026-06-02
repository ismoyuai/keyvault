# P5: 打包与测试完善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 确保应用可正确打包分发，完善错误处理和测试覆盖。

**Architecture:** 修复打包配置、优化 Vite 构建、添加全局错误边界、补全剩余测试。

**Tech Stack:** electron-builder, Vite, Vitest

---

### Task 1: 修复打包配置

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 修复依赖分类**

将 `vue`、`vue-router`、`element-plus` 从 `devDependencies` 移到 `dependencies`：

```bash
cd D:/keyvault
npm install vue vue-router element-plus
```

这会自动将它们移到 `dependencies`。

- [ ] **Step 2: 修复 package 脚本**

修改 `package.json` scripts：

```json
"scripts": {
  "dev": "vite --host",
  "build": "vite build",
  "start": "node scripts/start.cjs",
  "test": "vitest run",
  "test:watch": "vitest",
  "package": "vite build && electron-rebuild && electron-builder --win"
}
```

- [ ] **Step 3: 修复 files 配置**

修改 `package.json` build.files：

```json
"files": [
  "dist/**/*",
  "electron/**/*"
]
```

移除 `src/**/*`（Vite 已将前端编译到 dist/）。

- [ ] **Step 4: 生成 icon.ico**

如果 `build/icon.ico` 不存在，需要从 SVG 生成或提供一个 256x256 的 ico 文件。临时方案：

```bash
# 如果有 ImageMagick
convert build/icon.svg -resize 256x256 build/icon.ico
```

或者手动提供一个 ico 文件到 `build/icon.ico`。

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "fix: correct packaging configuration

- Move vue/vue-router/element-plus to dependencies
- Add electron-rebuild to package script
- Remove src/ from packaged files"
```

---

### Task 2: 优化 Vite 配置

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: 更新 vite.config.js**

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'chrome130', // 匹配 Electron 42
  },
  optimizeDeps: {
    include: ['element-plus'],
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add vite.config.js
git commit -m "chore: optimize Vite config for Electron 42

- Set build target to chrome130
- Add element-plus to optimized deps"
```

---

### Task 3: 添加全局错误边界

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: 添加 Vue 全局错误处理**

Modify `src/main.js`：

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { ElMessage } from 'element-plus'
import App from './App.vue'
import router from './router'
import './styles/global.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 全局错误边界
app.config.errorHandler = (err, vm, info) => {
  console.error('Unhandled error:', err, info)
  ElMessage.error('发生了一个错误，请重试')
}

// 未处理的 Promise rejection
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  ElMessage.error('操作失败，请重试')
})

app.mount('#app')
```

- [ ] **Step 2: Commit**

```bash
git add src/main.js
git commit -m "feat: add global error boundary and unhandled rejection handler"
```

---

### Task 4: 离线模式支持

**Files:**
- Modify: `src/views/SyncView.vue`

- [ ] **Step 1: 在 SyncView 中处理离线状态**

在 sync:push 和 sync:pull 的错误处理中，区分网络错误和其他错误：

```javascript
async function handlePush() {
  try {
    await syncStore.push()
    ElMessage.success('推送成功')
  } catch (e) {
    if (e.message.includes('ENOTFOUND') || e.message.includes('ETIMEDOUT') || e.message.includes('ECONNREFUSED')) {
      ElMessage.warning('网络连接失败，请检查网络后重试')
    } else {
      ElMessage.error(`推送失败: ${e.message}`)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/SyncView.vue
git commit -m "feat: graceful offline mode for WebDAV sync

Shows network-specific error messages and allows continued local usage."
```

---

### Task 5: 补全设置模块测试

**Files:**
- Create: `electron/__tests__/settings.test.cjs`

- [ ] **Step 1: 编写设置模块测试**

Create `electron/__tests__/settings.test.cjs`：

```javascript
const { describe, it, expect, beforeEach, afterEach } = require('vitest')
const path = require('path')
const fs = require('fs')
const { initDatabase, closeDatabase, getSetting, setSetting } = require('../storage/database.cjs')

describe('settings', () => {
  let testDbPath

  beforeEach(async () => {
    testDbPath = path.join(__dirname, `test-settings-${Date.now()}.db`)
    await initDatabase(testDbPath)
  })

  afterEach(() => {
    closeDatabase()
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
  })

  it('should get and set settings', () => {
    setSetting('autoLockMinutes', '15')
    expect(getSetting('autoLockMinutes')).toBe('15')
  })

  it('should overwrite existing setting', () => {
    setSetting('key', 'value1')
    setSetting('key', 'value2')
    expect(getSetting('key')).toBe('value2')
  })

  it('should return null for missing key', () => {
    expect(getSetting('nonexistent')).toBeNull()
  })

  it('should store device_id', () => {
    setSetting('device_id', 'test-device-123')
    expect(getSetting('device_id')).toBe('test-device-123')
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
npx vitest run electron/__tests__/settings.test.cjs
```

- [ ] **Step 3: Commit**

```bash
git add electron/__tests__/settings.test.cjs
git commit -m "test: add settings module unit tests"
```

---

### Task 6: 集成测试

**Files:**
- Create: `tests/integration/workflow.test.cjs`

- [ ] **Step 1: 创建集成测试**

Create `tests/integration/workflow.test.cjs`：

```javascript
const { describe, it, expect, beforeEach, afterEach } = require('vitest')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const {
  initDatabase, closeDatabase, addEntry, getEntry, updateEntry, deleteEntry,
  listEntries, searchEntries, addGroup, listGroups
} = require('../../electron/storage/database.cjs')
const { encryptField, decryptField } = require('../../electron/crypto/encryption.cjs')

describe('integration: full workflow', () => {
  let testKey
  let testDbPath

  beforeEach(async () => {
    testKey = crypto.randomBytes(32)
    testDbPath = path.join(__dirname, `test-integration-${Date.now()}.db`)
    await initDatabase(testDbPath)
  })

  afterEach(() => {
    closeDatabase()
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
  })

  it('should complete full CRUD workflow', () => {
    // Create group
    const groupId = addGroup('测试分组', 'folder', testKey)
    expect(groupId).toBeTruthy()

    // Create entry
    const entryId = addEntry({
      title: 'GitHub',
      username: 'user@example.com',
      password: 'MyStr0ng!Pass',
      url: 'https://github.com',
      type: 'password',
      group_id: groupId,
    }, testKey)
    expect(entryId).toBeTruthy()

    // Read entry
    const entry = getEntry(entryId, testKey)
    expect(entry.title).toBe('GitHub')
    expect(entry.username).toBe('user@example.com')
    expect(entry.password).toBe('MyStr0ng!Pass')
    expect(entry.url).toBe('https://github.com')

    // Update entry
    updateEntry(entryId, { title: 'GitHub Updated' }, testKey)
    const updated = getEntry(entryId, testKey)
    expect(updated.title).toBe('GitHub Updated')

    // Search
    const results = searchEntries('git', testKey)
    expect(results.length).toBe(1)
    expect(results[0].id).toBe(entryId)

    // Delete
    deleteEntry(entryId)
    const deleted = getEntry(entryId, testKey)
    expect(deleted).toBeNull()

    // List should be empty
    const all = listEntries(testKey, {})
    expect(all.length).toBe(0)
  })

  it('should handle multiple entries and groups', () => {
    addGroup('Group A', 'folder', testKey)
    addGroup('Group B', 'key', testKey)

    addEntry({ title: 'Entry 1', password: 'p1', type: 'password' }, testKey)
    addEntry({ title: 'Entry 2', password: 'p2', type: 'apikey' }, testKey)
    addEntry({ title: 'Entry 3', password: 'p3', type: 'password' }, testKey)

    const all = listEntries(testKey, {})
    expect(all.length).toBe(3)

    const groups = listGroups(testKey)
    expect(groups.length).toBeGreaterThanOrEqual(2)
  })

  it('should encrypt and decrypt fields correctly', () => {
    const plaintext = '敏感数据 🔐'
    const encrypted = encryptField(plaintext, testKey)
    expect(encrypted).not.toBe(plaintext)
    const decrypted = decryptField(encrypted, testKey)
    expect(decrypted).toBe(plaintext)
  })
})
```

- [ ] **Step 2: 运行集成测试**

```bash
npx vitest run tests/integration/workflow.test.cjs
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/workflow.test.cjs
git commit -m "test: add integration tests for full workflow"
```

---

### Task 7: P5 最终验证

- [ ] **Step 1: 运行全部测试**

```bash
npx vitest run
```

Expected: All tests PASS

- [ ] **Step 2: 验证打包**

```bash
npm run package
```

Expected: 构建成功，生成 `release/` 目录下的安装包

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "chore: P5 packaging and testing complete

- Fix packaging config (dependencies, icon, rebuild)
- Optimize Vite build for Electron 42
- Add global error boundary
- Add offline mode handling
- Add settings and integration tests"
```

---

## 全部完成

所有 5 个阶段完成后，运行最终验证：

```bash
# 运行所有测试
npx vitest run

# 构建前端
npm run build

# 打包应用
npm run package
```

最终项目状态：
- ✅ 无已知安全漏洞
- ✅ 清晰的架构和状态管理
- ✅ 完整的核心功能
- ✅ 一致的暗色主题和键盘快捷键
- ✅ 可靠的打包和测试覆盖
