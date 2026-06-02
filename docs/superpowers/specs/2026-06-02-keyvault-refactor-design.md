# KeyVault 全面重构设计文档

**日期**: 2026-06-02
**分支**: refactor/optimize-v1
**状态**: 已批准

## 概述

KeyVault 是一个基于 Electron 42 + Vue 3 + Element Plus 的本地密码管理器。本次重构目标是将其从"功能可用"提升至"生产级质量"，涵盖安全加固、架构重构、功能补全、UI 打磨、打包测试 5 个阶段。

## 当前状态分析

### 关键问题

| 类别 | 问题 | 严重度 |
|---|---|---|
| 安全 | `zeroBuffer` 导入错误，加密密钥无法清零 | 严重 |
| 安全 | 无 CSP 头，XSS 风险 | 严重 |
| 安全 | WebDAV 凭据明文存储 | 高 |
| 安全 | 缺少 will-navigate/权限控制 | 高 |
| 性能 | 数据库每次写操作全量导出 | 中 |
| 性能 | 搜索时解密全部条目 | 中 |
| 架构 | 无状态管理，全局变量控制认证 | 中 |
| 架构 | 后端 .cjs 文件混在 src/ 目录 | 低 |
| 功能 | 全量同步，无增量/冲突解决 | 中 |
| 功能 | 剪贴板/自动锁定/密码生成器未接入 | 中 |
| 打包 | icon.ico 缺失，无 electron-rebuild | 高 |
| 测试 | 零测试覆盖 | 高 |

### 架构现状

```
src/
  crypto/        ← 后端模块，不应在 src/
  storage/       ← 后端模块
  sync/          ← 后端模块
  import/        ← 后端模块
  utils/         ← 混合（后端 identity.cjs + 前端 clipboard/auto-lock/password-generator）
  views/         ← Vue 组件
  layouts/       ← Vue 布局
  router/        ← Vue 路由
  styles/        ← CSS
```

## 设计方案

### 总体原则

1. **分阶段递进**：5 个阶段，每阶段独立可运行、可测试
2. **数据兼容**：不破坏现有数据库 schema
3. **安全优先**：已知安全漏洞最先修复
4. **测试驱动**：核心模块（加密、数据库、同步）同步编写测试

### 目标目录结构

```
keyvault/
  electron/
    main.js              -- 主进程入口
    preload.cjs          -- 上下文桥接
    crypto/              -- 加密模块（从 src/ 迁移）
      key-derivation.cjs
      encryption.cjs
    storage/             -- 数据库模块（从 src/ 迁移）
      database.cjs
    sync/                -- 同步模块（从 src/ 迁移）
      sync-engine.cjs
      webdav-client.cjs
    import/              -- 导入模块（从 src/ 迁移）
      browser-csv.cjs
      text-parser.cjs
    utils/               -- 后端工具
      identity.cjs
  src/
    stores/              -- Pinia 状态管理
      auth.js
      entries.js
      groups.js
      settings.js
      sync.js
    composables/         -- 可复用逻辑
      useClipboard.js
      useAutoLock.js
      usePasswordGenerator.js
    views/               -- 不变
    layouts/             -- 不变
    router/              -- 不变
    styles/              -- 不变
  tests/
    unit/
      crypto/
      storage/
      sync/
      import/
    integration/
      workflow.test.js
```

### 测试框架

- **Vitest**：与 Vite 生态原生集成，零配置
- 核心模块在 P1/P2 阶段同步编写测试
- 其余模块在 P5 阶段补全

---

## 阶段详细设计

### P1：安全紧急修复

**目标**：消除所有已知安全漏洞，不改变功能行为。

#### 1.1 修复 zeroBuffer 导入 bug

**问题**：`electron/main.js` 第 11 行从 `key-derivation.cjs` 导入 `zeroBuffer`，但该函数实际定义在 `encryption.cjs` 中。导入结果为 `undefined`，导致加密密钥在锁定/密码变更时无法清零。

**修复**：改为从 `../src/crypto/encryption.cjs` 导入 `zeroBuffer`。

**验证**：锁定后检查 `encryptionKey` 是否被正确清零。

#### 1.2 添加 Content Security Policy

通过 `session.defaultSession.webRequest.onHeadersReceived` 注入 CSP 头：

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self';
font-src 'self';
```

- `style-src 'unsafe-inline'`：Element Plus 动态样式要求
- 不允许 `eval()`、外部脚本、外部连接

#### 1.3 加密 WebDAV 凭据

- 存储：使用主密码派生的密钥对 WebDAV 用户名/密码进行 AES-256-GCM 加密后存入 config.json
- 读取：仅在解锁状态下可解密访问
- 密钥派生复用现有的 Argon2id 流程，使用独立 salt

#### 1.4 Electron 权限最小化

- `will-navigate`：阻止 renderer 导航到非 `file://` 和非 `devtools://` 的 URL
- `setWindowOpenHandler`：拒绝所有 `window.open()` 调用
- `session.defaultSession.setPermissionRequestHandler`：拒绝 camera/microphone/notifications 等不需要的权限
- `sandbox: false` 保持（argon2 原生模块需要），添加注释说明

#### 1.5 核心模块测试

**encryption.cjs 测试**：
- 加密/解密往返：明文 → 加密 → 解密 → 原文
- 空字符串处理
- tampered 密文检测（修改 ciphertext 应抛出异常）
- 不同明文加密结果不同（随机 nonce）

**key-derivation.cjs 测试**：
- hashPassword 生成格式正确
- verifyPassword 正确密码返回 true
- verifyPassword 错误密码返回 false
- timingSafeEqual 确保常量时间比较

---

### P2：架构基础重构

**目标**：建立稳固的代码组织和状态管理基础。

#### 2.1 目录重组

将后端模块从 `src/` 迁移到 `electron/`：
- `src/crypto/` → `electron/crypto/`
- `src/storage/` → `electron/storage/`
- `src/sync/` → `electron/sync/`
- `src/import/` → `electron/import/`
- `src/utils/identity.cjs` → `electron/utils/identity.cjs`

更新 `electron/main.js` 中所有相对路径引用。

前端工具转为 composables：
- `src/utils/clipboard.js` → `src/composables/useClipboard.js`
- `src/utils/auto-lock.js` → `src/composables/useAutoLock.js`
- `src/utils/password-generator.js` → `src/composables/usePasswordGenerator.js`

#### 2.2 引入 Pinia 状态管理

| Store | 状态 | Actions |
|---|---|---|
| `auth` | `isUnlocked`, `passwordHash` | `unlock()`, `lock()`, `changePassword()` |
| `entries` | `entries`, `searchQuery`, `filteredEntries` | `loadEntries()`, `addEntry()`, `updateEntry()`, `deleteEntry()`, `search()` |
| `groups` | `groups`, `activeGroup` | `loadGroups()`, `addGroup()`, `updateGroup()`, `deleteGroup()` |
| `settings` | `autoLockTimeout`, `clipboardTimeout` | `loadSettings()`, `updateSetting()` |
| `sync` | `webdavConfig`, `syncStatus`, `lastSyncTime` | `configure()`, `testConnection()`, `push()`, `pull()` |

- 组件通过 `useXxxStore()` 获取状态
- Store 内部通过 `window.keyvault.xxx` IPC 接口与主进程通信
- `router.beforeEach` 改为检查 `useAuthStore().isUnlocked`

#### 2.3 数据库模块优化

**事务支持**：
```javascript
beginTransaction()  // db.run('BEGIN TRANSACTION')
commit()            // db.run('COMMIT')
rollback()          // db.run('ROLLBACK')
```

**批量写入**：
```javascript
addEntries(entries)  // BEGIN → 多条 INSERT → COMMIT → saveDb()
```
CSV 导入调用 `addEntries()` 而非循环调用 `addEntry()`。

**Statement 安全**：
```javascript
queryAll(sql, params) {
  const stmt = db.prepare(sql)
  try {
    // ... bind, step, getAsObject
  } finally {
    stmt.free()
  }
}
```

**软删除清理**：
```javascript
purgeDeleted(olderThanDays = 30) {
  // DELETE FROM entries WHERE deleted = 1 AND updated_at < ?
}
```

**索引优化**：
```sql
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_group ON entries(group_id);
CREATE INDEX IF NOT EXISTS idx_entries_favorite ON entries(favorite);
CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(deleted);
```

#### 2.4 核心模块测试

**database.cjs 测试**：
- CRUD 操作完整性
- 事务提交和回滚
- 批量写入性能对比
- 软删除和清理
- Statement 泄漏检测

**import 模块测试**：
- Chrome CSV 解析正确性
- Firefox CSV 解析正确性
- 去重逻辑（url|username 相同）
- 文本解析（JSON、KEY=VALUE、表格）

---

### P3：核心功能补全

**目标**：让产品功能完整，解决用户日常使用痛点。

#### 3.1 增量同步

**当前问题**：每次 push 上传全量数据，pull 全量替换。多设备使用时数据丢失风险高。

**设计方案**：

1. **pull 流程**：
   - 下载远程数据
   - 逐条对比 `updated_at` 时间戳
   - 远程 > 本地 → 更新本地
   - 本地 > 远程 → 保留本地（下次 push 上传）
   - 冲突（同一条目两端都修改过）→ 保留较新版本，记录冲突日志

2. **push 流程**：
   - 查询本地 `updated_at` > 上次同步时间的条目
   - 只上传变更条目（增量 diff）
   - 更新同步时间戳

3. **冲突处理**：
   - 同一条目两端都修改 → 保留 `updated_at` 较新的版本
   - 冲突记录存入 `sync_meta` 表，用户可在设置中查看

4. **同步元数据**：
   - `last_sync_time`：上次同步时间
   - `last_sync_checksum`：上次同步后的数据校验和

#### 3.2 密码强度审计

新增 IPC `audit:passwords`，实时计算（不存储）：

| 规则 | 描述 | 严重度 |
|---|---|---|
| 弱密码 | 长度 < 12 或无特殊字符 | 高 |
| 重复密码 | 相同密码用于多个条目 | 高 |
| 旧密码 | 超过 90 天未更新 | 中 |

返回格式：
```json
{
  "weak": [{ "id": "...", "title": "...", "reason": "..." }],
  "duplicate": [{ "ids": [...], "title": "..." }],
  "old": [{ "id": "...", "title": "...", "lastUpdated": "..." }],
  "score": 85
}
```

Dashboard 添加"安全审计"入口，显示警告徽章。

#### 3.3 剪贴板自动清除

转为 composable `useClipboard()`：
- 复制密码后启动定时器（默认 30 秒）
- 到期后清空剪贴板
- 与 Settings 中的"剪贴板清除时间"联动
- 应用最小化/失焦时立即清除

#### 3.4 自动锁定

转为 composable `useAutoLock()`：
- 监听 `mousemove`/`keydown`/`click` 事件
- 无操作超时后调用 `auth.lock()`
- 与 Settings 中的"自动锁定时间"联动
- 锁定时触发剪贴板清除

#### 3.5 密码生成器 UI

在添加/编辑条目对话框中：
- 显示"生成密码"按钮
- 选项：长度滑块（8-64）、大小写字母/数字/特殊字符复选框
- 生成后显示密码强度指示
- 复制到剪贴板后自动启用 30 秒清除

#### 3.6 核心模块测试

**sync-engine.cjs 测试**：
- 增量 diff 逻辑：新增/修改/删除/冲突
- checksum 计算一致性
- 冲突解决策略

**audit 测试**：
- 弱密码检测（长度、复杂度）
- 重复密码检测
- 旧密码检测

---

### P4：UI 适度打磨

**目标**：修复已知 UI bug，提升视觉一致性和操作效率。

#### 4.1 暗色主题一致性

- 审计所有 Element Plus 组件的暗色表现
- 统一 CSS 变量覆盖：`--el-bg-color`、`--el-text-color`、`--el-border-color` 等
- 修复输入框、弹窗、右键菜单、下拉选择器的背景色不一致
- 确保 `global.css` 覆盖完整

#### 4.2 已知 UI Bug 修复

1. **EntryDetailView**：`group_id` 显示为分组名称而非原始 ID
   - 通过 `groups` store 查询分组名称
2. **DashboardView**：`?favorites=1` 查询参数监听
   - 从 `onMounted` 改为 `watch(route.query, ...)` 响应式监听
3. **MainLayout**：移除空的 `startDrag` 函数绑定

#### 4.3 键盘快捷键

在 `MainLayout.vue` 中注册全局快捷键：

| 快捷键 | 功能 |
|---|---|
| `Ctrl+N` | 快速添加新条目 |
| `Ctrl+F` | 聚焦搜索框 |
| `Ctrl+L` | 锁定应用 |
| `Ctrl+1-5` | 切换侧边栏分组 |
| `Escape` | 关闭弹窗/返回列表 |

#### 4.4 密码强度显示

- 条目列表：密码列旁显示强度圆点（绿/黄/红）
- 详情页：密码字段下方显示强度条
- 复用审计模块的强度评估逻辑

---

### P5：打包与测试完善

**目标**：确保应用可正确打包分发，测试覆盖达标。

#### 5.1 打包配置修复

- 生成 `build/icon.ico`（256x256，从 SVG 转换或手动提供）
- `package.json` scripts 修改：
  ```json
  "package": "vite build && electron-rebuild && electron-builder --win"
  ```
- `files` 配置调整：
  ```json
  "files": ["dist/**/*", "electron/**/*"]
  ```
  移除 `src/**/*`（Vite 已将前端编译到 dist/）

#### 5.2 Vite 配置优化

```javascript
// vite.config.js
export default {
  build: {
    target: 'chrome130'  // 匹配 Electron 42
  },
  optimizeDeps: {
    include: ['element-plus']
  }
}
```

#### 5.3 依赖整理

从 `devDependencies` 移到 `dependencies`：
- `vue`
- `vue-router`
- `element-plus`

#### 5.4 剩余模块测试

**设置模块测试**：
- 设置读写
- 密码变更流程（旧密码验证 → 新密码设置 → 重新加密）

**组件测试**（可选，视时间而定）：
- LoginView 基本流程
- DashboardView 搜索/过滤

**集成测试**：
- 完整流程：解锁 → 添加条目 → 搜索 → 编辑 → 删除 → 锁定

#### 5.5 错误处理完善

**全局错误边界**：
```javascript
// src/main.js
app.config.errorHandler = (err, vm, info) => {
  // 记录错误，显示友好提示
  console.error('Unhandled error:', err, info)
  ElMessage.error('发生了一个错误，请重试')
}
```

**IPC 错误统一格式**：
```javascript
// 主进程所有 handler 统一返回
{ success: true, data: ... }
// 或
{ success: false, error: '错误描述' }
```

**离线模式**：
- WebDAV 连接失败时显示警告但不影响本地操作
- 同步按钮在离线时禁用，显示"离线"状态

---

## 数据兼容性

- 数据库 schema 不变，现有数据无需迁移
- `config.json` 新增 WebDAV 加密字段，旧字段向后兼容
- 同步协议变更：增量同步需要双方都是新版本，旧版本 push 的全量数据仍可被新版本 pull

## 不做的事（YAGNI）

- 不添加动画系统
- 不做响应式布局（桌面应用固定窗口）
- 不做无障碍访问（本次重构范围）
- 不添加 Linux/macOS 构建目标
- 不做代码签名
- 不做自动更新（electron-updater）
- 不添加标签 UI（tags_encrypted 字段保留但不暴露）
