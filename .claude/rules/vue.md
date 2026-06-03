---
paths: ["src/**"]
---

# Vue 渲染进程规则

## 状态管理

- 使用 Pinia stores (`src/stores/`) 管理全局状态
- 不要使用 `window.__keyvault_unlocked` 等全局变量 (已迁移到 auth store)
- stores 通过 `window.keyvault.*` IPC 接口与主进程通信

## 组件组织

- `src/views/` — 页面组件 (6 个: Login/Dashboard/EntryDetail/Import/Settings/Sync)
- `src/layouts/` — 布局组件 (MainLayout: 侧边栏 + 标题栏 + router-view)
- `src/composables/` — 可复用逻辑，以 `use` 开头命名
- `src/stores/` — Pinia stores (auth/entries/groups/settings/sync)

## Composables

- `useClipboard()` — 剪贴板复制 + 自动清除 (与 settings.clipboardClearSeconds 联动)
- `useAutoLock()` — 无操作自动锁定 (与 settings.autoLockMinutes 联动)
- `usePasswordGenerator()` — 密码生成 + 强度评估

## 与主进程通信

所有 IPC 调用通过 `window.keyvault.*`:

```javascript
// ✅ 正确
const entries = await window.keyvault.entries.list({})

// ❌ 错误 - 渲染进程不能 require
const { listEntries } = require('./storage/database.cjs')
```

## 路由

- 使用 `createWebHashHistory` (hash 模式，适合 Electron file:// 加载)
- 路由守卫检查 `useAuthStore().isUnlocked`
- 未解锁时重定向到 `/login`

## UI 框架

- Element Plus 全局注册
- 暗色主题 CSS 变量: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--text-primary`, `--text-secondary`, `--border`, `--accent`, `--danger`
- Element Plus 变量覆盖: `--el-bg-color`, `--el-text-color-primary` 等

## 禁止事项

- ❌ 在 Vue 组件中直接 require 任何模块
- ❌ 在模板中写复杂逻辑 (提取到 computed 或 methods)
- ❌ 使用 `window.__keyvault_unlocked` (使用 auth store)
- ❌ 直接调用 `window.keyvault.clipboard.copy()` (使用 useClipboard composable)

## Gotchas

1. **favorites 路由**: DashboardView watch `route.query` 处理 group 和 favorites 参数，使用 `{ immediate: true }`
2. **group_id 显示**: EntryDetailView 使用 `getGroupName()` 将 ID 转换为分组名称
3. **密码强度**: LoginView 和 usePasswordGenerator 中的强度评估逻辑相同 (8 分制)
4. **审计异步加载**: DashboardView onMounted 中调用 `window.keyvault.audit.passwords()`，失败时静默忽略
