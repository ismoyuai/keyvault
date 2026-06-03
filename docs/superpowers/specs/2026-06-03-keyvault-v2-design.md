# KeyVault v2 功能扩展设计文档

> **日期**: 2026-06-03
> **状态**: 已批准
> **范围**: 模板系统、UI 重新设计、主题系统、桌面端优化、浏览器扩展

---

## 1. 概述

KeyVault v2 在 v1 重构的基础上，扩展以下能力：

- **模板系统**：支持 10 种条目类型模板，覆盖 API 密钥、服务器凭据、云服务、软件许可证等场景
- **UI 重新设计**：参考 1Password/Bitwarden 的专业简洁风格，优化布局和交互
- **主题系统**：暗色+浅色双主题，支持跟随系统自动切换
- **桌面端优化**：快捷键、系统托盘、最近使用、拖拽分组
- **浏览器扩展**（Phase 2）：Chrome/Firefox 自动填充、密码保存提示

### 设计原则

- **渐进扩展**：在现有架构上扩展，不破坏已有功能
- **向后兼容**：现有条目自动映射为对应模板，无需数据迁移
- **安全不变**：加密机制、零知识架构、CSP 策略保持不变

---

## 2. 模板系统

### 2.1 数据模型变更

在 `entries` 表新增两个字段：

```sql
ALTER TABLE entries ADD COLUMN template_id TEXT DEFAULT 'password';
ALTER TABLE entries ADD COLUMN custom_fields_encrypted TEXT;
```

- `template_id`：模板标识，决定条目的字段布局和图标
- `custom_fields_encrypted`：JSON 格式的自定义字段，AES-256-GCM 加密

### 2.2 模板定义

| template_id | 显示名 | 图标 | 专有字段 |
|---|---|---|---|
| `password` | 网站密码 | key | url, username, password |
| `apikey` | API 密钥 | code | key, endpoint, rate_limit |
| `note` | 安全笔记 | file-text | content |
| `server` | 服务器 | server | host, port, username, password/ssh_key |
| `cloud` | 云服务 | cloud | service, access_key, secret_key, region |
| `software` | 软件许可证 | package | license_key, email, expiry_date |
| `identity` | 身份信息 | user | email, phone, address |
| `crypto_wallet` | 加密钱包 | wallet | address, private_key, mnemonic |
| `ssh_key` | SSH 密钥 | terminal | public_key, private_key, passphrase |
| `custom` | 自定义 | file | 用户自定义字段 |

### 2.3 向后兼容

- 现有 `type='password'` → 映射为 `template_id='password'`
- 现有 `type='apikey'` → 映射为 `template_id='apikey'`
- 现有 `type='note'` → 映射为 `template_id='note'`

### 2.4 custom_fields 结构

```json
{
  "fields": [
    { "key": "rate_limit", "label": "Rate Limit", "value": "1000/min", "type": "text" },
    { "key": "expiry", "label": "过期时间", "value": "2027-01-01", "type": "date" }
  ]
}
```

字段类型：`text`, `password`, `textarea`, `date`, `url`, `email`

---

## 3. UI 重新设计

### 3.1 整体布局

```
┌─────────────────────────────────────────────────┐
│  Titlebar (32px)                          ─ □ ✕ │
├──────────┬──────────────────────────────────────┤
│          │  Toolbar: [搜索] [新建▾] [视图] [排序] │
│ Sidebar  ├──────────────────────────────────────┤
│ (240px)  │                                      │
│          │  Entry List / Grid                    │
│ 搜索框    │  ┌─────────────────────────────┐     │
│          │  │ 🔑 GitHub                   │     │
│ 全部      │  │    user@example.com         │     │
│ 收藏      │  │    2小时前更新               │     │
│ 最近      │  └─────────────────────────────┘     │
│ 审计      │                                      │
│          │                                      │
│ ──分组──  │                                      │
│ 默认      │                                      │
│ API Keys  │                                      │
│ 网站账号  │                                      │
│          │                                      │
│          ├──────────────────────────────────────┤
│ 设置      │  Detail Panel (右侧滑出, 400px)      │
│ 锁定      │  条目详情、编辑、复制操作              │
└──────────┴──────────────────────────────────────┘
```

### 3.2 侧边栏重构

- **顶部**：KeyVault logo + 搜索框（Ctrl+K 触发）
- **导航区**：全部、收藏、最近使用、安全审计
- **分组区**：可折叠分组列表，支持右键菜单（重命名、删除、图标选择）
- **底部**：设置、同步状态指示器、锁定按钮

### 3.3 条目列表

- **列表视图**：单行卡片，显示模板图标、标题、副标题、最后更新时间
- **网格视图**：卡片网格，适合浏览大量条目
- **Hover 效果**：显示快速操作按钮（复制用户名、复制密码、编辑）
- **选中状态**：高亮选中条目

### 3.4 条目详情面板

点击条目后，右侧滑出详情面板（400px 宽）：
- 顶部：模板图标 + 标题 + 模板类型标签
- 字段区：根据模板类型显示对应字段，每个字段有复制按钮
- 自定义字段区：显示 custom_fields 中的字段
- 底部：编辑、删除、收藏按钮
- 元数据：创建时间、更新时间、设备 ID

### 3.5 新建条目

点击"新建"按钮弹出模板选择器：
- 网格展示所有模板，每个模板显示图标+名称
- 选择模板后打开对应表单
- 表单字段根据模板类型动态生成

### 3.6 图标系统

使用 Lucide Icons 替换 emoji：
- 统一的线性图标风格
- 支持 SVG 渲染，清晰度不受分辨率影响
- 与 Element Plus 组件风格协调

---

## 4. 主题系统

### 4.1 CSS 变量定义

```css
/* 暗色主题 */
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
  --border: #d2d2d7;
  --shadow: rgba(0, 0, 0, 0.1);
}
```

### 4.2 主题切换机制

**Electron 主进程**：
```javascript
const { nativeTheme } = require('electron')

// 监听系统主题变化
nativeTheme.on('updated', () => {
  mainWindow.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
})

// IPC: 获取当前主题
ipcMain.handle('theme:get', () => {
  const config = loadConfig()
  return config.theme || 'system'  // 'dark', 'light', 'system'
})

// IPC: 设置主题
ipcMain.handle('theme:set', (event, theme) => {
  const config = loadConfig()
  config.theme = theme
  saveConfig(config)
  nativeTheme.themeSource = theme
})
```

**渲染进程**：
```javascript
// 应用主题
function applyTheme(theme) {
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  document.documentElement.setAttribute('data-theme', resolved)
}
```

### 4.3 设置界面

在设置页面新增主题选项：
- 暗色模式
- 浅色模式
- 跟随系统（默认）

---

## 5. 桌面端体验优化

### 5.1 快捷键系统

| 快捷键 | 功能 |
|---|---|
| `Ctrl+K` | 全局搜索/命令面板 |
| `Ctrl+N` | 新建条目 |
| `Ctrl+L` | 锁定应用 |
| `Ctrl+B` | 复制当前条目密码 |
| `Ctrl+Shift+B` | 复制当前条目用户名 |
| `Escape` | 关闭面板/对话框 |

### 5.2 系统托盘

- 最小化到系统托盘
- 右键菜单：显示窗口、快速搜索、锁定、退出
- 点击托盘图标显示/隐藏主窗口

### 5.3 最近使用

- 记录条目的 `last_accessed_at` 时间戳
- 侧边栏"最近使用"显示最近 20 条访问过的条目
- 点击直接打开详情面板

### 5.4 拖拽分组

- 条目可拖拽到侧边栏分组
- 拖拽时高亮目标分组
- 释放后更新条目的 group_id

### 5.5 批量操作

- Ctrl+Click 多选条目
- Shift+Click 范围选择
- 批量操作菜单：删除、移动分组、导出

---

## 6. 浏览器扩展（Phase 2）

### 6.1 架构

```
┌─────────────────┐     Native Messaging     ┌──────────────────┐
│  Chrome/Firefox │ ◄──────────────────────► │  Electron 主进程  │
│  Extension      │     (stdio/JSON)         │  (NM Host)       │
└─────────────────┘                          └──────────────────┘
                                                      │
                                                      ▼
                                              ┌──────────────────┐
                                              │  KeyVault DB     │
                                              │  (sql.js)        │
                                              └──────────────────┘
```

### 6.2 Native Messaging Host

Electron 主进程注册为 native messaging host：
- 应用安装时写入 host manifest 到系统注册表
- 监听 stdin 消息，处理查询请求
- 返回加密的凭据数据

### 6.3 扩展功能

**自动填充**：
- Content script 检测页面中的登录表单
- 匹配 URL 与已保存凭据
- 在输入框旁显示 KeyVault 图标
- 点击图标选择凭据填充

**密码保存提示**：
- 监听表单提交事件
- 检测到用户名+密码字段时弹出保存提示
- 通过 native messaging 发送到 Electron 保存

**弹出窗口**：
- 搜索凭据
- 一键复制用户名/密码
- 显示当前域名匹配的凭据

### 6.4 安全策略

- 扩展不存储任何凭据数据
- 所有数据通过 native messaging 实时获取
- 需要 KeyVault 解锁状态
- 连接超时（5 秒）自动断开
- 每次通信需要用户确认（可配置为自动信任）

---

## 7. 实施计划

### Phase 1：桌面端优化（当前阶段）

| 子阶段 | 内容 | 预估工作量 |
|---|---|---|
| P1.1 | 数据库模板字段 + 模板定义 | 中 |
| P1.2 | UI 重构：侧边栏 + 条目列表 + 详情面板 | 大 |
| P1.3 | 主题系统：暗色/浅色 + 系统切换 | 中 |
| P1.4 | Lucide Icons 替换 | 小 |
| P1.5 | 快捷键 + 系统托盘 | 中 |
| P1.6 | 最近使用 + 拖拽分组 | 中 |

### Phase 2：浏览器扩展

| 子阶段 | 内容 | 预估工作量 |
|---|---|---|
| P2.1 | Native Messaging Host | 中 |
| P2.2 | Chrome 扩展：自动填充 | 大 |
| P2.3 | Chrome 扩展：密码保存 | 中 |
| P2.4 | Firefox 扩展适配 | 中 |

---

## 8. 技术约束

- **加密不变**：所有敏感字段（custom_fields）使用 AES-256-GCM 加密
- **向后兼容**：现有条目无需迁移，自动适配模板系统
- **性能**：条目列表支持虚拟滚动，1000+ 条目流畅
- **安全**：浏览器扩展不存储凭据，所有数据通过 native messaging 获取
- **CSP**：浏览器扩展使用最小权限原则
