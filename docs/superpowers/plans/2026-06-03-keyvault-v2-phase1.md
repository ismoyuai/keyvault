# KeyVault v2 Phase 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 KeyVault 添加模板系统、UI 重新设计、主题系统、桌面端体验优化

**Architecture:** 在现有架构上渐进扩展。数据库新增 template_id/custom_fields/last_accessed_at 字段。前端通过 CSS 变量实现主题切换，Lucide Icons 替换 emoji。侧边栏/列表/详情面板重构为组件化架构。

**Tech Stack:** Vue 3 + Pinia + Element Plus + Vite 6, Electron 42 (CJS), sql.js (WASM), Lucide Icons

---

## 文件结构

### 新建文件
| 文件 | 职责 |
|---|---|
| `src/constants/templates.js` | 模板定义（10 种类型） |
| `src/composables/useTheme.js` | 主题切换逻辑 |
| `src/components/Sidebar.vue` | 侧边栏组件 |
| `src/components/EntryCard.vue` | 条目卡片组件 |
| `src/components/DetailPanel.vue` | 右侧滑出详情面板 |
| `src/components/TemplateSelector.vue` | 模板选择对话框 |
| `src/components/CommandPalette.vue` | Ctrl+K 命令面板 |
| `src/components/ThemeSwitcher.vue` | 主题切换组件 |
| `electron/tray.cjs` | 系统托盘模块 |

### 修改文件
| 文件 | 变更 |
|---|---|
| `electron/storage/database.cjs` | 新增 template_id, custom_fields_encrypted, last_accessed_at 字段 |
| `electron/main.js` | 主题 IPC、托盘初始化、新字段处理 |
| `electron/preload.cjs` | 暴露新 API |
| `src/styles/global.css` | 浅色主题变量、新组件样式 |
| `src/layouts/MainLayout.vue` | 重构为组件化架构 |
| `src/views/DashboardView.vue` | 使用新组件重构 |
| `src/views/EntryDetailView.vue` | 转为详情面板内嵌视图 |
| `src/views/SettingsView.vue` | 添加主题设置 |
| `src/stores/entries.js` | 支持模板字段 |
| `src/main.js` | 注册 Lucide Icons |
| `package.json` | 添加 lucide-vue-next 依赖 |

---

## Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 lucide-vue-next**

```bash
cd D:/keyvault
npm install lucide-vue-next
```

- [ ] **Step 2: 验证安装**

```bash
npm ls lucide-vue-next
```

Expected: lucide-vue-next@最新版本

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: add lucide-vue-next for icon system"
```

---

## Task 2: 数据库模板字段

**Files:**
- Modify: `electron/storage/database.cjs`
- Modify: `electron/storage/__tests__/database.test.cjs`

- [ ] **Step 1: 编写测试 — 模板字段**

在 `electron/storage/__tests__/database.test.cjs` 中添加：

```javascript
test('addEntry with template_id and custom_fields', async () => {
  const { initDatabase, addEntry, getEntry, closeDatabase } = require('../database.cjs')
  const os = require('os')
  const path = require('path')
  const dbPath = path.join(os.tmpdir(), `test-template-${Date.now()}.db`)

  await initDatabase(dbPath)
  const key = Buffer.alloc(32, 0x01)

  const id = addEntry({
    type: 'password',
    template_id: 'server',
    title: 'My Server',
    username: 'root',
    password: 'secret',
    url: '',
    notes: '',
    custom_fields: { fields: [
      { key: 'host', label: 'Host', value: '192.168.1.1', type: 'text' },
      { key: 'port', label: 'Port', value: '22', type: 'text' },
    ]},
    device_id: 'test',
  }, key)

  const entry = getEntry(id, key)
  expect(entry.template_id).toBe('server')
  expect(entry.custom_fields.fields).toHaveLength(2)
  expect(entry.custom_fields.fields[0].value).toBe('192.168.1.1')

  closeDatabase()
  try { require('fs').unlinkSync(dbPath) } catch {}
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd D:/keyvault && npx vitest run electron/storage/__tests__/database.test.cjs
```

Expected: FAIL — template_id 和 custom_fields 字段不存在

- [ ] **Step 3: 修改数据库初始化**

在 `electron/storage/database.cjs` 的 `initDatabase` 函数中，在现有 CREATE TABLE 语句后添加：

```javascript
// 迁移：添加新字段（如果不存在）
try {
  db.run('ALTER TABLE entries ADD COLUMN template_id TEXT DEFAULT "password"')
} catch {} // 字段已存在则忽略
try {
  db.run('ALTER TABLE entries ADD COLUMN custom_fields_encrypted TEXT')
} catch {}
try {
  db.run('ALTER TABLE entries ADD COLUMN last_accessed_at TEXT')
} catch {}
```

将此代码放在 `saveDb()` 之前（约第 55 行之前）。

- [ ] **Step 4: 修改 addEntry 函数**

在 `electron/storage/database.cjs` 的 `addEntry` 函数中（约第 92-113 行），修改 INSERT 语句：

```javascript
function addEntry(data, key) {
  const now = new Date().toISOString()
  const id = uuidv4()
  db.run(
    `INSERT INTO entries (id, type, template_id, title_encrypted, username_encrypted, password_encrypted,
     url_encrypted, notes_encrypted, group_id, tags_encrypted, favorite,
     created_at, updated_at, last_accessed_at, device_id, deleted, custom_fields_encrypted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.type || 'password',
     data.template_id || data.type || 'password',
     encryptField(data.title, key),
     encryptField(data.username, key),
     encryptField(data.password, key),
     encryptField(data.url, key),
     encryptField(data.notes, key),
     data.group_id || 'default',
     encryptField(JSON.stringify(data.tags || []), key),
     data.favorite ? 1 : 0,
     now, now, now,
     data.device_id || 'unknown', 0,
     data.custom_fields ? encryptField(JSON.stringify(data.custom_fields), key) : null]
  )
  saveDb()
  return id
}
```

- [ ] **Step 5: 修改 decryptRow 函数**

在 `electron/storage/database.cjs` 的 `decryptRow` 函数中（约第 201-220 行），添加新字段解密：

```javascript
function decryptRow(row, key) {
  try {
    return {
      id: row.id, type: row.type,
      template_id: row.template_id || row.type || 'password',
      title: decryptField(row.title_encrypted, key),
      username: decryptField(row.username_encrypted, key),
      password: decryptField(row.password_encrypted, key),
      url: decryptField(row.url_encrypted, key),
      notes: decryptField(row.notes_encrypted, key),
      group_id: row.group_id,
      tags: JSON.parse(decryptField(row.tags_encrypted, key) || '[]'),
      favorite: row.favorite === 1,
      created_at: row.created_at, updated_at: row.updated_at,
      last_accessed_at: row.last_accessed_at,
      device_id: row.device_id,
      custom_fields: row.custom_fields_encrypted
        ? JSON.parse(decryptField(row.custom_fields_encrypted, key) || '{}')
        : null,
    }
  } catch {
    return { id: row.id, type: row.type, template_id: row.type || 'password',
      title: '[解密失败]', username: '', password: '',
      url: '', notes: '', group_id: row.group_id, tags: [], favorite: false,
      created_at: row.created_at, updated_at: row.updated_at,
      last_accessed_at: row.last_accessed_at, device_id: row.device_id, custom_fields: null }
  }
}
```

- [ ] **Step 6: 修改 addEntries 批量函数**

在 `electron/storage/database.cjs` 的 `addEntries` 函数中（约第 276-308 行），同步修改 INSERT 语句：

```javascript
function addEntries(dataArray, key) {
  const now = new Date().toISOString()
  beginTransaction()
  try {
    const ids = []
    for (const data of dataArray) {
      const id = uuidv4()
      db.run(
        `INSERT INTO entries (id, type, template_id, title_encrypted, username_encrypted, password_encrypted,
         url_encrypted, notes_encrypted, group_id, tags_encrypted, favorite,
         created_at, updated_at, last_accessed_at, device_id, deleted, custom_fields_encrypted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.type || 'password',
         data.template_id || data.type || 'password',
         encryptField(data.title, key),
         encryptField(data.username, key),
         encryptField(data.password, key),
         encryptField(data.url, key),
         encryptField(data.notes, key),
         data.group_id || 'default',
         encryptField(JSON.stringify(data.tags || []), key),
         data.favorite ? 1 : 0,
         now, now, now,
         data.device_id || 'unknown', 0,
         data.custom_fields ? encryptField(JSON.stringify(data.custom_fields), key) : null]
      )
      ids.push(id)
    }
    commit()
    saveDb()
    return ids
  } catch (e) {
    rollback()
    throw e
  }
}
```

- [ ] **Step 7: 添加 updateLastAccessed 函数**

在 `electron/storage/database.cjs` 中添加新函数（在 `updateEntry` 函数之后）：

```javascript
function updateLastAccessed(id) {
  db.run('UPDATE entries SET last_accessed_at = ? WHERE id = ?', [new Date().toISOString(), id])
  saveDb()
}
```

在 `module.exports` 中添加 `updateLastAccessed`。

- [ ] **Step 8: 修改 updateEntry 支持新字段**

在 `electron/storage/database.cjs` 的 `updateEntry` 函数中（约第 120-140 行），添加 custom_fields 支持：

在 `if (data.favorite !== undefined)` 之后添加：

```javascript
if (data.custom_fields !== undefined) {
  sets.push('custom_fields_encrypted = ?')
  params.push(encryptField(JSON.stringify(data.custom_fields), key))
}
```

- [ ] **Step 9: 运行测试确认通过**

```bash
cd D:/keyvault && npx vitest run electron/storage/__tests__/database.test.cjs
```

Expected: All tests PASS

- [ ] **Step 10: 提交**

```bash
git add electron/storage/database.cjs electron/storage/__tests__/database.test.cjs
git commit -m "feat: add template_id, custom_fields, last_accessed_at to database"
```

---

## Task 3: 模板定义

**Files:**
- Create: `src/constants/templates.js`

- [ ] **Step 1: 创建模板定义文件**

```javascript
export const TEMPLATES = {
  password: {
    id: 'password',
    name: '网站密码',
    icon: 'Key',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
      { key: 'password', label: '密码', type: 'password', required: true },
      { key: 'url', label: '网址', type: 'url', required: false },
    ],
  },
  apikey: {
    id: 'apikey',
    name: 'API 密钥',
    icon: 'Code',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
      { key: 'password', label: 'API Key', type: 'password', required: true },
      { key: 'url', label: 'Endpoint', type: 'url', required: false },
    ],
    customFieldPresets: [
      { key: 'rate_limit', label: 'Rate Limit', type: 'text' },
    ],
  },
  note: {
    id: 'note',
    name: '安全笔记',
    icon: 'FileText',
    fields: [
      { key: 'notes', label: '内容', type: 'textarea', required: false },
    ],
  },
  server: {
    id: 'server',
    name: '服务器',
    icon: 'Server',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
      { key: 'password', label: '密码/密钥', type: 'password', required: true },
    ],
    customFieldPresets: [
      { key: 'host', label: 'Host', type: 'text' },
      { key: 'port', label: 'Port', type: 'text' },
      { key: 'ssh_key', label: 'SSH Key', type: 'textarea' },
    ],
  },
  cloud: {
    id: 'cloud',
    name: '云服务',
    icon: 'Cloud',
    fields: [
      { key: 'username', label: '账号', type: 'text', required: false },
      { key: 'password', label: 'Secret Key', type: 'password', required: true },
    ],
    customFieldPresets: [
      { key: 'service', label: '服务商', type: 'text' },
      { key: 'access_key', label: 'Access Key', type: 'text' },
      { key: 'region', label: 'Region', type: 'text' },
    ],
  },
  software: {
    id: 'software',
    name: '软件许可证',
    icon: 'Package',
    fields: [
      { key: 'username', label: '注册邮箱', type: 'email', required: false },
      { key: 'password', label: 'License Key', type: 'password', required: true },
    ],
    customFieldPresets: [
      { key: 'expiry_date', label: '过期时间', type: 'date' },
    ],
  },
  identity: {
    id: 'identity',
    name: '身份信息',
    icon: 'User',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
    ],
    customFieldPresets: [
      { key: 'email', label: '邮箱', type: 'email' },
      { key: 'phone', label: '电话', type: 'text' },
      { key: 'address', label: '地址', type: 'textarea' },
    ],
  },
  crypto_wallet: {
    id: 'crypto_wallet',
    name: '加密钱包',
    icon: 'Wallet',
    fields: [
      { key: 'username', label: '钱包名称', type: 'text', required: false },
      { key: 'password', label: '密码', type: 'password', required: false },
    ],
    customFieldPresets: [
      { key: 'address', label: '地址', type: 'text' },
      { key: 'private_key', label: '私钥', type: 'password' },
      { key: 'mnemonic', label: '助记词', type: 'textarea' },
    ],
  },
  ssh_key: {
    id: 'ssh_key',
    name: 'SSH 密钥',
    icon: 'Terminal',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
      { key: 'password', label: 'Passphrase', type: 'password', required: false },
    ],
    customFieldPresets: [
      { key: 'public_key', label: '公钥', type: 'textarea' },
      { key: 'private_key', label: '私钥', type: 'textarea' },
    ],
  },
  custom: {
    id: 'custom',
    name: '自定义',
    icon: 'File',
    fields: [
      { key: 'username', label: '用户名', type: 'text', required: false },
      { key: 'password', label: '密码', type: 'password', required: false },
    ],
  },
}

export const TEMPLATE_LIST = Object.values(TEMPLATES)

export function getTemplate(id) {
  return TEMPLATES[id] || TEMPLATES.custom
}

export function getTemplateIcon(id) {
  const template = getTemplate(id)
  return template.icon
}
```

- [ ] **Step 2: 提交**

```bash
git add src/constants/templates.js
git commit -m "feat: add template definitions for 10 entry types"
```

---

## Task 4: 主题系统

**Files:**
- Create: `src/composables/useTheme.js`
- Modify: `src/styles/global.css`
- Modify: `electron/main.js`
- Modify: `electron/preload.cjs`
- Modify: `src/views/SettingsView.vue`

- [ ] **Step 1: 编写 useTheme composable**

创建 `src/composables/useTheme.js`：

```javascript
import { ref, watch, onMounted, onUnmounted } from 'vue'

const currentTheme = ref('dark') // 'dark' | 'light'
const themePreference = ref('system') // 'dark' | 'light' | 'system'

export function useTheme() {
  function applyTheme(theme) {
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme
    currentTheme.value = resolved
    document.documentElement.setAttribute('data-theme', resolved)
  }

  async function init() {
    try {
      const saved = await window.keyvault.theme.get()
      themePreference.value = saved
      applyTheme(saved)
    } catch {
      applyTheme('system')
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (themePreference.value === 'system') {
        applyTheme('system')
      }
    })

    // Listen for theme changes from main process
    if (window.keyvault.theme.onChange) {
      window.keyvault.theme.onChange((event, theme) => {
        applyTheme(theme)
      })
    }
  }

  async function setTheme(theme) {
    themePreference.value = theme
    applyTheme(theme)
    try {
      await window.keyvault.theme.set(theme)
    } catch {}
  }

  return {
    currentTheme,
    themePreference,
    init,
    setTheme,
  }
}
```

- [ ] **Step 2: 添加 CSS 主题变量**

在 `src/styles/global.css` 中，将现有的 `:root` 变量改为暗色主题，并添加浅色主题：

```css
/* 暗色主题（默认） */
:root,
[data-theme="dark"] {
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #252525;
  --bg-hover: #2a2a2a;
  --text-primary: #e0e0e0;
  --text-secondary: #888;
  --accent: #409eff;
  --accent-hover: #66b1ff;
  --danger: #f56c6c;
  --success: #67c23a;
  --warning: #e6a23c;
  --border: #333;
  --shadow: rgba(0, 0, 0, 0.3);
}

/* 浅色主题 */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #e8e8ed;
  --bg-hover: #dcdce0;
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --accent: #0071e3;
  --accent-hover: #0077ed;
  --danger: #ff3b30;
  --success: #34c759;
  --warning: #ff9500;
  --border: #d2d2d7;
  --shadow: rgba(0, 0, 0, 0.1);
}
```

- [ ] **Step 3: 添加主题 IPC**

在 `electron/main.js` 中添加主题相关 IPC handler（在 `// --- Settings ---` 部分之前）：

```javascript
// --- Theme ---
const { nativeTheme } = require('electron')

ipcMain.handle('theme:get', wrapIPC(() => {
  const config = loadConfig()
  return config.theme || 'system'
}))

ipcMain.handle('theme:set', wrapIPC((event, theme) => {
  const config = loadConfig()
  config.theme = theme
  saveConfig(config)
  nativeTheme.themeSource = theme
  return { success: true }
}))

// Send theme changes to renderer
nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  }
})
```

- [ ] **Step 4: 暴露主题 API**

在 `electron/preload.cjs` 中添加 theme 对象（在 `dialog` 之前）：

```javascript
theme: {
  get: async () => unwrap(await ipcRenderer.invoke('theme:get')),
  set: async (theme) => unwrap(await ipcRenderer.invoke('theme:set', theme)),
  onChange: (callback) => ipcRenderer.on('theme:changed', callback),
},
```

- [ ] **Step 5: 更新设置页面**

在 `src/views/SettingsView.vue` 的设置卡片中添加主题选项：

在 `<script setup>` 中添加：

```javascript
import { useTheme } from '@/composables/useTheme'
const { themePreference, setTheme } = useTheme()
```

在模板的安全设置卡片后添加：

```html
<div class="settings-card">
  <h3>外观</h3>
  <div class="setting-item">
    <div class="setting-label">主题</div>
    <el-select v-model="themePreference" @change="setTheme">
      <el-option value="dark" label="暗色" />
      <el-option value="light" label="浅色" />
      <el-option value="system" label="跟随系统" />
    </el-select>
  </div>
</div>
```

- [ ] **Step 6: 提交**

```bash
git add src/composables/useTheme.js src/styles/global.css electron/main.js electron/preload.cjs src/views/SettingsView.vue
git commit -m "feat: add theme system with dark/light/system modes"
```

---

## Task 5: Lucide Icons 集成

**Files:**
- Modify: `src/main.js`
- Modify: `src/layouts/MainLayout.vue`
- Modify: `src/views/DashboardView.vue`
- Modify: `src/views/EntryDetailView.vue`

- [ ] **Step 1: 注册 Lucide Icons**

在 `src/main.js` 中添加：

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as LucideIcons from 'lucide-vue-next'
import App from './App.vue'
import router from './router'
import './styles/global.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)

// Register commonly used Lucide icons globally
const iconsToRegister = [
  'Key', 'Code', 'FileText', 'Server', 'Cloud', 'Package', 'User',
  'Wallet', 'Terminal', 'File', 'Search', 'Plus', 'Star', 'Heart',
  'Copy', 'Eye', 'EyeOff', 'Trash2', 'Edit', 'Settings', 'Lock',
  'LogOut', 'Folder', 'Globe', 'Shield', 'ChevronRight', 'ChevronLeft',
  'X', 'Check', 'AlertTriangle', 'RefreshCw', 'Download', 'Upload',
  'Sun', 'Moon', 'Monitor', 'Menu', 'MoreVertical', 'ExternalLink',
  'Clock', 'ArrowLeft', 'Home', 'Import', 'Palette',
]
iconsToRegister.forEach(name => {
  if (LucideIcons[name]) {
    app.component(name, LucideIcons[name])
  }
})

app.mount('#app')

// Error handling (existing)
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason)
})
```

- [ ] **Step 2: 提交**

```bash
git add src/main.js
git commit -m "feat: integrate Lucide Icons globally"
```

---

## Task 6: 侧边栏组件

**Files:**
- Create: `src/components/Sidebar.vue`
- Modify: `src/layouts/MainLayout.vue`

- [ ] **Step 1: 创建 Sidebar 组件**

创建 `src/components/Sidebar.vue`：

```vue
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
  border-radius: 0;
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
```

- [ ] **Step 2: 重构 MainLayout 使用 Sidebar**

将 `src/layouts/MainLayout.vue` 的模板部分替换为使用新 Sidebar 组件：

```vue
<template>
  <div class="main-layout">
    <!-- 自定义标题栏 -->
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
        @group-context="showGroupContext"
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
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/groups'
import { useEntriesStore } from '@/stores/entries'
import Sidebar from '@/components/Sidebar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { ElMessageBox, ElMessage } from 'element-plus'

const route = useRoute()
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
  if (e.key === 'Escape') {
    showCommandPalette.value = false
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

function showGroupContext(event, group) {
  // Context menu handled by parent
}

function lockApp() {
  auth.lock()
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
```

- [ ] **Step 3: 提交**

```bash
git add src/components/Sidebar.vue src/layouts/MainLayout.vue
git commit -m "feat: extract sidebar component with Lucide Icons"
```

---

## Task 7: 条目卡片组件

**Files:**
- Create: `src/components/EntryCard.vue`

- [ ] **Step 1: 创建 EntryCard 组件**

创建 `src/components/EntryCard.vue`：

```vue
<template>
  <div class="entry-card" :class="{ selected }" @click="$emit('click')">
    <div class="card-icon">
      <component :is="iconComponent" :size="20" />
    </div>
    <div class="card-info">
      <div class="card-title">{{ entry.title }}</div>
      <div class="card-subtitle">
        <span v-if="entry.username" class="subtitle-user">{{ entry.username }}</span>
        <span v-if="entry.url" class="subtitle-url">{{ displayUrl }}</span>
      </div>
    </div>
    <div class="card-meta">
      <span class="meta-time">{{ timeAgo }}</span>
    </div>
    <div class="card-actions" @click.stop>
      <button v-if="entry.username" class="action-btn" @click="$emit('copyUsername')" title="复制用户名">
        <User :size="14" />
      </button>
      <button class="action-btn" @click="$emit('copyPassword')" title="复制密码">
        <Copy :size="14" />
      </button>
      <button class="action-btn" @click="$emit('toggleFavorite')" title="收藏">
        <Star :size="14" :fill="entry.favorite ? 'currentColor' : 'none'" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TEMPLATES } from '@/constants/templates'

const props = defineProps({
  entry: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

defineEmits(['click', 'copyUsername', 'copyPassword', 'toggleFavorite'])

const iconComponent = computed(() => {
  const template = TEMPLATES[props.entry.template_id || props.entry.type]
  return template ? template.icon : 'File'
})

const displayUrl = computed(() => {
  if (!props.entry.url) return ''
  try {
    return new URL(props.entry.url).hostname
  } catch {
    return props.entry.url
  }
})

const timeAgo = computed(() => {
  const date = props.entry.last_accessed_at || props.entry.updated_at
  if (!date) return ''
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(date).toLocaleDateString('zh-CN')
})
</script>

<style scoped>
.entry-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}
.entry-card:hover {
  background: var(--bg-hover);
  border-color: var(--border);
}
.entry-card.selected {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.card-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border-radius: 8px;
  color: var(--accent);
  flex-shrink: 0;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-subtitle {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.subtitle-user {
  color: var(--accent);
}

.subtitle-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  flex-shrink: 0;
}

.meta-time {
  font-size: 11px;
  color: var(--text-secondary);
}

.card-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.entry-card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--bg-tertiary);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.action-btn:hover {
  background: var(--accent);
  color: white;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/components/EntryCard.vue
git commit -m "feat: add EntryCard component with Lucide Icons"
```

---

## Task 8: 模板选择器组件

**Files:**
- Create: `src/components/TemplateSelector.vue`

- [ ] **Step 1: 创建 TemplateSelector 组件**

创建 `src/components/TemplateSelector.vue`：

```vue
<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)"
             title="选择类型" width="520px" :append-to-body="true">
    <div class="template-grid">
      <div v-for="template in TEMPLATE_LIST" :key="template.id"
           class="template-card" @click="selectTemplate(template.id)">
        <div class="template-icon">
          <component :is="template.icon" :size="24" />
        </div>
        <div class="template-name">{{ template.name }}</div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { TEMPLATE_LIST } from '@/constants/templates'

defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'select'])

function selectTemplate(templateId) {
  emit('select', templateId)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.template-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 8px 0;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.template-card:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
  transform: translateY(-2px);
}

.template-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  border-radius: 10px;
  color: var(--accent);
}

.template-name {
  font-size: 12px;
  color: var(--text-primary);
  text-align: center;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/components/TemplateSelector.vue
git commit -m "feat: add template selector dialog component"
```

---

## Task 9: 命令面板组件

**Files:**
- Create: `src/components/CommandPalette.vue`

- [ ] **Step 1: 创建 CommandPalette 组件**

创建 `src/components/CommandPalette.vue`：

```vue
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
          <div v-else-if="query" class="palette-empty">
            未找到匹配的条目
          </div>
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

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

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
  if (!q.trim()) {
    results.value = []
    return
  }
  results.value = await entriesStore.searchEntries(q)
})

function getIcon(entry) {
  const template = TEMPLATES[entry.template_id || entry.type]
  return template ? template.icon : 'File'
}

function openEntry(entry) {
  router.push(`/app/entry/${entry.id}`)
  close()
}

async function copyPassword(entry) {
  await clipboardCopy(entry.password, '密码')
  ElMessage.success('密码已复制')
  close()
}

function selectFirst() {
  if (results.value.length > 0) {
    openEntry(results.value[0])
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.palette-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  justify-content: center;
  padding-top: 15vh;
}

.palette-container {
  width: 520px;
  max-height: 400px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 16px 48px var(--shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.palette-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
}

.palette-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
}
.palette-input::placeholder {
  color: var(--text-secondary);
}

.palette-results {
  overflow-y: auto;
  padding: 8px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}
.palette-item:hover {
  background: var(--bg-hover);
}

.item-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border-radius: 8px;
  color: var(--accent);
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 14px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.1s;
}
.palette-item:hover .item-actions {
  opacity: 1;
}

.item-action {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--bg-tertiary);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.item-action:hover {
  background: var(--accent);
  color: white;
}

.palette-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

/* Transition */
.palette-enter-active,
.palette-leave-active {
  transition: opacity 0.15s;
}
.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/components/CommandPalette.vue
git commit -m "feat: add command palette (Ctrl+K) component"
```

---

## Task 10: 重构 DashboardView

**Files:**
- Modify: `src/views/DashboardView.vue`

- [ ] **Step 1: 重写 DashboardView**

用以下内容替换 `src/views/DashboardView.vue`：

```vue
<template>
  <div class="dashboard">
    <!-- 顶部工具栏 -->
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

    <!-- 安全审计警告 -->
    <div v-if="auditResult && auditResult.score < 80" class="audit-banner" @click="showAudit = true">
      <AlertTriangle :size="16" />
      <span>安全评分: {{ auditResult.score }}/100 — 点击查看详情</span>
    </div>

    <!-- 条目类型筛选 -->
    <div class="filter-bar">
      <button v-for="f in filters" :key="f.key" class="filter-chip"
              :class="{ active: activeFilter === f.key }"
              @click="setFilter(f.key)">
        <component :is="f.icon" :size="14" />
        <span>{{ f.label }}</span>
      </button>
    </div>

    <!-- 条目列表 -->
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

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">
        <Inbox :size="48" />
      </div>
      <div class="empty-text">{{ searchQuery ? '未找到匹配的条目' : '还没有任何条目' }}</div>
      <button v-if="!searchQuery" class="btn-new" @click="showTemplateSelector = true">
        添加第一个条目
      </button>
    </div>

    <!-- 模板选择器 -->
    <TemplateSelector v-model="showTemplateSelector" @select="onTemplateSelect" />

    <!-- 新建条目对话框 -->
    <el-dialog v-model="showAddDialog" :title="`新建${selectedTemplate?.name || '条目'}`" width="500px" :append-to-body="true">
      <el-form :model="newEntry" label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model="newEntry.title" placeholder="如: GitHub, OpenAI" />
        </el-form-item>
        <el-form-item v-for="field in templateFields" :key="field.key" :label="field.label" :required="field.required">
          <el-input v-model="newEntry[field.key]" :type="field.type === 'password' ? 'password' : 'text'"
                    :show-password="field.type === 'password'" :placeholder="field.label" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="newEntry.notes" type="textarea" :rows="3" />
        </el-form-item>

        <!-- 自定义字段预设 -->
        <template v-if="selectedTemplate?.customFieldPresets?.length">
          <div class="custom-fields-header">额外信息</div>
          <el-form-item v-for="preset in selectedTemplate.customFieldPresets" :key="preset.key" :label="preset.label">
            <el-input v-model="customFields[preset.key]" :type="preset.type === 'password' ? 'password' : 'text'"
                      :show-password="preset.type === 'password'" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addEntry" :disabled="!newEntry.title">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 右键菜单 -->
    <div v-if="contextMenu.show" class="context-menu" :style="contextMenuStyle"
         @click="contextMenu.show = false">
      <div class="ctx-item" @click="copyUsername(contextMenu.entry)">
        <User :size="14" /> 复制用户名
      </div>
      <div class="ctx-item" @click="copyPassword(contextMenu.entry)">
        <Key :size="14" /> 复制密码
      </div>
      <div class="ctx-item" @click="openEntry(contextMenu.entry.id)">
        <Edit :size="14" /> 编辑
      </div>
      <div class="ctx-item" @click="toggleFavorite(contextMenu.entry)">
        <Star :size="14" /> {{ contextMenu.entry.favorite ? '取消收藏' : '收藏' }}
      </div>
      <div class="ctx-separator"></div>
      <div class="ctx-item danger" @click="confirmDelete(contextMenu.entry)">
        <Trash2 :size="14" /> 删除
      </div>
    </div>

    <!-- 审计对话框 -->
    <el-dialog v-model="showAudit" title="安全审计报告" width="600px" :append-to-body="true">
      <div v-if="auditResult" class="audit-report">
        <div class="audit-score">
          <div class="score-circle" :class="scoreLevel">
            {{ auditResult.score }}
          </div>
          <div class="score-label">安全评分</div>
        </div>

        <div v-if="auditResult.weak.length > 0" class="audit-section">
          <h4><AlertTriangle :size="14" /> 弱密码 ({{ auditResult.weak.length }})</h4>
          <div v-for="item in auditResult.weak" :key="item.id" class="audit-item">
            <span>{{ item.title }}</span>
            <span class="audit-reason">{{ item.reason }}</span>
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
            <span>{{ item.title }}</span>
            <span class="audit-reason">最后更新: {{ new Date(item.lastUpdated).toLocaleDateString('zh-CN') }}</span>
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
import { useClipboard } from '@/composables/useClipboard'
import { usePasswordGenerator } from '@/composables/usePasswordGenerator'
import { TEMPLATES } from '@/constants/templates'
import EntryCard from '@/components/EntryCard.vue'
import TemplateSelector from '@/components/TemplateSelector.vue'

const route = useRoute()
const router = useRouter()
const entriesStore = useEntriesStore()
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

const newEntry = ref({
  title: '',
  username: '',
  password: '',
  url: '',
  notes: '',
})
const customFields = ref({})

const templateFields = computed(() => {
  return selectedTemplate.value?.fields || []
})

const pageTitle = computed(() => {
  if (route.query.favorites) return '⭐ 收藏'
  if (route.query.recent) return '🕐 最近使用'
  if (route.query.group) {
    // Get group name from store
    return '📁 分组'
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
  await entriesStore.loadEntries()
  try {
    auditResult.value = await window.keyvault.audit.passwords()
  } catch {}
})

watch(() => route.query, (query) => {
  if (query.group) {
    entriesStore.loadEntries({ group_id: query.group })
  } else if (query.favorites) {
    entriesStore.loadEntries({ favorites: true })
  } else if (query.recent) {
    entriesStore.loadEntries({ recent: true })
  } else {
    entriesStore.loadEntries()
  }
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

    // Build custom fields
    const fields = []
    if (selectedTemplate.value?.customFieldPresets) {
      for (const preset of selectedTemplate.value.customFieldPresets) {
        if (customFields.value[preset.key]) {
          fields.push({ ...preset, value: customFields.value[preset.key] })
        }
      }
    }
    if (fields.length > 0) {
      data.custom_fields = { fields }
    }

    await entriesStore.addEntry(data)
    showAddDialog.value = false
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function openEntry(id) {
  selectedId.value = id
  router.push(`/app/entry/${id}`)
}

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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-title {
  font-size: 18px;
  color: var(--text-primary);
  font-weight: 600;
}

.btn-new {
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s;
}
.btn-new:hover { background: var(--accent-hover); }

.filter-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
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

.entry-list { display: flex; flex-direction: column; gap: 4px; }

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}
.empty-icon { margin-bottom: 16px; color: var(--text-secondary); }
.empty-text { margin-bottom: 16px; }

.custom-fields-header {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 16px 0 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 4px;
}
.ctx-item:hover { background: var(--bg-hover); }
.ctx-item.danger { color: var(--danger); }
.ctx-separator { height: 1px; background: var(--border); margin: 4px 0; }

.audit-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(230, 162, 60, 0.15);
  border: 1px solid var(--warning);
  border-radius: 8px;
  margin-bottom: 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--warning);
}
.audit-banner:hover { background: rgba(230, 162, 60, 0.25); }

.audit-report { padding: 8px; }
.audit-score { text-align: center; margin-bottom: 24px; }
.score-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  font-size: 28px;
  font-weight: bold;
  color: white;
  margin-bottom: 8px;
}
.score-circle.good { background: var(--success); }
.score-circle.fair { background: var(--warning); }
.score-circle.weak { background: var(--danger); }
.score-label { font-size: 14px; color: var(--text-secondary); }

.audit-section { margin-bottom: 16px; }
.audit-section h4 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.audit-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 13px;
}
.audit-reason { color: var(--text-secondary); }
</style>
```

- [ ] **Step 2: 运行应用验证 UI**

```bash
cd D:/keyvault && npm run dev
```

Expected: 应用启动，侧边栏显示新图标，条目列表使用新卡片组件

- [ ] **Step 3: 提交**

```bash
git add src/views/DashboardView.vue
git commit -m "feat: refactor DashboardView with new components and template support"
```

---

## Task 11: 更新 entries store

**Files:**
- Modify: `src/stores/entries.js`

- [ ] **Step 1: 更新 entries store 支持模板字段**

在 `src/stores/entries.js` 中确保 `addEntry` 和 `updateEntry` 传递新字段：

```javascript
// 在 addEntry action 中，确保传递 template_id 和 custom_fields
async addEntry(data) {
  const id = await window.keyvault.entries.add({
    type: data.type || 'password',
    template_id: data.template_id || data.type || 'password',
    title: data.title,
    username: data.username || '',
    password: data.password || '',
    url: data.url || '',
    notes: data.notes || '',
    group_id: data.group_id || 'default',
    tags: data.tags || [],
    custom_fields: data.custom_fields || null,
  })
  await this.loadEntries()
  return id
},
```

- [ ] **Step 2: 提交**

```bash
git add src/stores/entries.js
git commit -m "feat: update entries store for template fields"
```

---

## Task 12: 系统托盘

**Files:**
- Create: `electron/tray.cjs`
- Modify: `electron/main.js`

- [ ] **Step 1: 创建托盘模块**

创建 `electron/tray.cjs`：

```javascript
const { Tray, Menu, nativeImage } = require('electron')
const path = require('path')

let tray = null

function createTray(mainWindow, onLock) {
  // Create a simple icon using nativeImage
  const icon = nativeImage.createEmpty()

  tray = new Tray(icon)
  tray.setToolTip('KeyVault')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    {
      label: '锁定',
      click: () => {
        onLock()
        mainWindow.hide()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        mainWindow.destroy()
      }
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow.show()
    }
  })
}

function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

module.exports = { createTray, destroyTray }
```

- [ ] **Step 2: 集成到 main.js**

在 `electron/main.js` 中添加：

```javascript
const { createTray } = require('./tray.cjs')
```

在 `createWindow` 函数末尾添加：

```javascript
// 系统托盘
createTray(mainWindow, lockApp)

// 最小化到托盘而不是关闭
mainWindow.on('close', (event) => {
  if (!app.isQuitting) {
    event.preventDefault()
    mainWindow.hide()
  }
})
```

在 `app.on('window-all-closed')` 之前添加：

```javascript
app.on('before-quit', () => {
  app.isQuitting = true
})
```

- [ ] **Step 3: 提交**

```bash
git add electron/tray.cjs electron/main.js
git commit -m "feat: add system tray with minimize-to-tray"
```

---

## Task 13: 测试与验证

**Files:**
- Modify: `electron/storage/__tests__/database.test.cjs`

- [ ] **Step 1: 运行所有现有测试**

```bash
cd D:/keyvault && npm run test
```

Expected: All tests PASS

- [ ] **Step 2: 验证主题切换**

```bash
cd D:/keyvault && npm run start
```

手动验证：
1. 进入设置页面，切换暗色/浅色/跟随系统
2. 确认主题正确切换
3. 确认所有组件在两种主题下都正常显示

- [ ] **Step 3: 验证模板系统**

手动验证：
1. 点击"新建"，确认模板选择器显示 10 种类型
2. 选择"服务器"模板，填写表单
3. 确认条目保存后显示正确的图标和字段

- [ ] **Step 4: 验证快捷键**

手动验证：
1. Ctrl+K 打开命令面板
2. 搜索条目并打开
3. Escape 关闭面板

- [ ] **Step 5: 验证系统托盘**

手动验证：
1. 关闭窗口，确认最小化到托盘
2. 点击托盘图标，确认窗口恢复
3. 右键托盘菜单，确认锁定功能正常

- [ ] **Step 6: 最终提交**

```bash
git add -A
git commit -m "feat: KeyVault v2 Phase 1 complete - templates, themes, UI redesign"
```
