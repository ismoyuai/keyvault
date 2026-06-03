<div align="center">

# 🔐 KeyVault

**本地加密密码与 API Key 管理器**

*零知识架构 · 数据自主可控 · 私有化部署*

[![构建状态](https://img.shields.io/badge/构建-通过-brightgreen?style=flat-square)]()
[![测试状态](https://img.shields.io/badge/测试-60/60-brightgreen?style=flat-square)]()
[![许可证](https://img.shields.io/badge/许可证-MIT-blue?style=flat-square)]()
[![Electron](https://img.shields.io/badge/Electron-42-47848F?style=flat-square&logo=electron)]()
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D?style=flat-square&logo=vue.js)]()
[![加密](https://img.shields.io/badge/加密-AES--256--GCM-yellow?style=flat-square)]()

</div>

---

## 📖 简介

KeyVault 是一款现代化的本地密码管理器，专为注重隐私和数据安全的用户设计。采用零知识架构，所有数据均加密存储在本地，支持通过 WebDAV 进行私有云同步，确保您的凭据数据完全由您掌控。

### 🎯 核心理念

- **零知识**: 我们无法访问您的任何数据
- **本地优先**: 数据存储在您的设备上，不依赖第三方云服务
- **私有化部署**: 支持 NAS + WebDAV 私有云同步
- **数据自主可控**: 您拥有数据的完全控制权

---

## ✨ 功能特性

### 🔑 多类型凭据管理

支持 10 种专业模板，满足不同场景需求：

| 模板类型 | 说明 | 典型用途 |
|---------|------|---------|
| 🌐 网站密码 | 网站登录凭据 | GitHub、Google、社交媒体 |
| 🔑 API 密钥 | API Token 和密钥 | OpenAI、AWS、各种 API |
| 📝 安全笔记 | 加密文本笔记 | 恢复代码、配置信息 |
| 🖥️ 服务器 | 服务器连接信息 | SSH、RDP、数据库连接 |
| ☁️ 云服务 | 云平台凭据 | AWS、Azure、GCP |
| 💻 软件许可证 | 软件授权信息 | 序列号、激活码 |
| 👤 身份信息 | 个人身份数据 | 身份证、护照信息 |
| 💰 加密钱包 | 钱包助记词 | 助记词、私钥 |
| 🔐 SSH 密钥 | SSH 密钥对 | 服务器密钥、Git 密钥 |
| 📋 自定义 | 自定义字段 | 任意类型数据 |

### 🎨 现代化界面

- **深色/浅色主题**: 支持三种主题模式（深色、浅色、跟随系统）
- **响应式设计**: 流畅的动画和过渡效果
- **专业图标系统**: 采用 Lucide Icons，界面简洁美观
- **命令面板**: `Ctrl+K` 快速搜索和导航
- **系统托盘**: 最小化到托盘，快速访问

### 🔒 企业级安全

- **AES-256-GCM 加密**: 军事级加密算法
- **Argon2id 密钥派生**: 抵抗暴力破解攻击
- **字段级加密**: 每个敏感字段独立加密
- **内存安全**: 密钥使用后立即清零
- **零知识证明**: 我们无法访问您的数据

### 🌐 浏览器扩展

- **自动填充**: 检测登录表单，一键填充凭据
- **密码保存**: 自动捕获并提示保存新密码
- **快速搜索**: 在浏览器中快速搜索凭据
- **安全通信**: 通过 Native Messaging 安全连接

### ☁️ 私有云同步

- **WebDAV 协议**: 支持标准 WebDAV 服务
- **增量同步**: 智能合并，避免冲突
- **端到端加密**: 同步过程中数据始终保持加密
- **多设备支持**: 在多个设备间无缝同步

---

## 🚀 快速开始

### 系统要求

- **操作系统**: Windows 10/11 (64-bit)
- **Node.js**: 18.0 或更高版本
- **npm**: 9.0 或更高版本

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/ismoyuai/keyvault.git
cd keyvault
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 启动开发环境

```bash
# 仅启动前端开发服务器
npm run dev

# 启动完整应用（前端 + Electron）
npm run start
```

#### 4. 构建生产版本

```bash
# 构建前端
npm run build

# 完整打包（生成安装包）
npm run package
```

### 首次使用

1. **设置主密码**: 首次启动时设置您的主密码
2. **添加凭据**: 点击 "+" 按钮添加新的凭据
3. **选择模板**: 根据凭据类型选择合适的模板
4. **开始使用**: 享受安全的密码管理体验

---

## ⚙️ 配置指南

### 主密码安全

```bash
# 主密码要求
- 最少 8 个字符
- 建议使用密码短语（如：correct-horse-battery-staple）
- 不要使用常见密码
- 定期更换主密码
```

### 自动锁定

在设置中配置自动锁定时间：
- 5 分钟（推荐）
- 15 分钟（默认）
- 30 分钟
- 从不（不推荐）

### 剪贴板安全

配置剪贴板自动清除时间：
- 10 秒（推荐）
- 30 秒（默认）
- 60 秒

### WebDAV 同步配置

#### 支持的 WebDAV 服务

- **群晖 NAS**: Synology WebDAV Server
- **威联通 NAS**: QNAP WebDAV
- **坚果云**: Nutstore WebDAV
- **Nextcloud**: 自建私有云
- **自建服务**: 任何标准 WebDAV 服务

#### 配置步骤

1. 打开设置 → 同步配置
2. 输入 WebDAV 服务器信息：
   ```
   服务器地址: https://your-nas.com:5006
   用户名: your-username
   密码: your-password
   ```
3. 点击"测试连接"验证配置
4. 启用自动同步或手动同步

#### 同步策略

- **增量同步**: 仅同步变更的数据
- **冲突处理**: 智能合并，保留最新版本
- **加密传输**: 所有数据在传输前加密
- **断点续传**: 支持网络中断后继续同步

---

## 🔐 安全提醒

### 加密算法

| 组件 | 算法 | 说明 |
|------|------|------|
| 字段加密 | AES-256-GCM | 12 字节随机 nonce + 16 字节 auth tag |
| 密钥派生 | Argon2id | memoryCost=65536, timeCost=3, parallelism=1 |
| 哈希存储 | Argon2id | 主密码哈希存储，无法逆向 |

### 安全最佳实践

1. **主密码管理**
   - 使用强密码短语
   - 不要与其他账户共用密码
   - 定期更换主密码
   - 不要忘记主密码（无法恢复）

2. **设备安全**
   - 保持操作系统更新
   - 使用防病毒软件
   - 不要在公共设备上使用
   - 启用设备加密

3. **同步安全**
   - 使用 HTTPS 连接
   - 定期更换 WebDAV 密码
   - 监控同步日志
   - 不要在公共 Wi-Fi 同步

4. **备份策略**
   - 定期导出加密备份
   - 将备份存储在安全位置
   - 测试备份恢复流程
   - 保留多个备份版本

### 已知限制

- 主密码丢失无法恢复
- 不支持多用户共享
- 浏览器扩展需要应用运行
- WebDAV 同步需要网络连接

---

## 🛠️ 开发指南

### 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      KeyVault 架构                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Vue 3      │    │  Electron 42 │    │  Browser     │  │
│  │   Frontend   │◄──►│  Main Process│◄──►│  Extension   │  │
│  │   (ESM)      │    │  (CJS)       │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │          │
│         ▼                   ▼                   ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Pinia      │    │  sql.js      │    │  Native      │  │
│  │   State      │    │  (WASM)      │    │  Messaging   │  │
│  │   Management │    │  Database    │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                             │                               │
│                             ▼                               │
│                      ┌──────────────┐                       │
│                      │  AES-256-GCM │                       │
│                      │  + Argon2id  │                       │
│                      │  Encryption  │                       │
│                      └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### 目录结构

```
keyvault/
├── electron/                  # Electron 主进程 (CJS)
│   ├── main.js               # IPC handlers、认证、CRUD、同步入口
│   ├── preload.cjs           # contextBridge 安全桥接
│   ├── crypto/               # Argon2id 密钥派生 + AES-256-GCM 加解密
│   ├── storage/              # sql.js 数据库模块 (WASM)
│   ├── sync/                 # WebDAV 同步引擎 (增量同步)
│   ├── import/               # Chrome/Firefox CSV + 文本解析
│   ├── native-messaging/     # 浏览器扩展通信
│   ├── utils/                # 设备标识生成
│   └── tray.cjs              # 系统托盘
├── src/                       # Vue 渲染进程 (ESM)
│   ├── stores/               # Pinia 状态管理
│   ├── composables/          # Vue 组合式函数
│   ├── views/                # 页面组件
│   ├── layouts/              # 布局组件
│   ├── components/           # 通用组件
│   ├── router/               # Vue Router (hash 模式)
│   └── styles/               # 全局 CSS
├── extension/                  # 浏览器扩展
│   ├── manifest.json         # 扩展配置
│   ├── background.js         # 后台服务
│   ├── content.js            # 内容脚本
│   ├── popup.html/js         # 弹出窗口
│   └── icons/                # 扩展图标
├── tests/                      # 测试文件
│   └── integration/          # 集成测试
├── docs/                       # 文档
│   └── superpowers/          # 设计文档和计划
├── package.json              # 项目配置
├── vite.config.js            # Vite 配置
├── vitest.config.js          # 测试配置
└── CLAUDE.md                 # 项目说明
```

### 命令速查

```bash
# 开发
npm run dev              # 启动 Vite 开发服务器 (端口 5173)
npm run start            # 启动 Vite + Electron 完整应用

# 测试
npm run test             # 运行所有测试
npm run test:watch       # 测试监听模式

# 构建
npm run build            # 仅构建前端
npm run package          # 完整打包 (生成安装包)

# 代码质量
npm run lint             # ESLint 检查
npm run format           # Prettier 格式化
```

### 测试策略

```bash
# 测试文件位置
electron/*/__tests__/*.test.cjs    # 后端单元测试
tests/integration/*.test.cjs       # 集成测试

# 测试框架
Vitest - 快速、现代的测试框架

# 测试覆盖率
60/60 测试全部通过
```

### 提交规范

```
feat:     新功能
fix:      Bug 修复
security: 安全相关
refactor: 重构
test:     测试
chore:    构建/配置/依赖
style:    样式调整
docs:     文档
```

### 扩展开发

#### 添加新的凭据模板

1. 在 `src/constants/templates.js` 中定义模板
2. 在 `electron/storage/database.cjs` 中添加数据库支持
3. 在 `src/views/DashboardView.vue` 中添加表单渲染
4. 添加相应的测试

#### 自定义主题

1. 在 `src/styles/global.css` 中定义 CSS 变量
2. 在 `src/composables/useTheme.js` 中添加主题逻辑
3. 在设置界面中添加主题选项

---

## 📋 路线图

### ✅ 已完成 (v1.0)

- [x] 基础密码管理功能
- [x] AES-256-GCM 加密
- [x] Argon2id 密钥派生
- [x] WebDAV 同步
- [x] 导入导出功能
- [x] 密码生成器
- [x] 自动锁定
- [x] 系统托盘

### ✅ 已完成 (v2.0)

- [x] 10 种条目模板
- [x] 深色/浅色主题
- [x] 全局搜索命令面板
- [x] Lucide Icons 图标系统
- [x] 浏览器扩展自动填充
- [x] 密码保存提示
- [x] 响应式界面设计

### 🚧 开发中 (v2.1)

- [ ] Firefox 扩展适配
- [ ] 拖拽分组功能
- [ ] 详情面板滑出效果
- [ ] 批量操作功能
- [ ] 快捷键系统

### 📅 计划中 (v3.0)

- [ ] 移动端应用 (iOS/Android)
- [ ] 多因素认证 (MFA)
- [ ] 团队共享功能
- [ ] 审计日志
- [ ] 自动密码更换
- [ ] 生物识别解锁

---

## 🤝 贡献指南

我们欢迎社区贡献！请遵循以下步骤：

### 1. Fork 项目

```bash
# Fork 到您的 GitHub 账户
# 然后克隆到本地
git clone https://github.com/your-username/keyvault.git
```

### 2. 创建功能分支

```bash
git checkout -b feature/your-feature-name
```

### 3. 提交更改

```bash
git commit -m "feat: add your feature description"
```

### 4. 推送分支

```bash
git push origin feature/your-feature-name
```

### 5. 创建 Pull Request

- 清晰描述您的更改
- 包含相关测试
- 确保所有测试通过
- 遵循代码风格指南

### 开发环境要求

- Node.js 18+
- npm 9+
- Git
- 现代代码编辑器 (推荐 VS Code)

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

```
MIT License

Copyright (c) 2026 KeyVault

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 致谢

感谢以下开源项目：

- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Element Plus](https://element-plus.org/) - Vue 3 UI 组件库
- [sql.js](https://github.com/sql-js/sql.js/) - WebAssembly SQLite
- [Lucide](https://lucide.dev/) - 美观的开源图标
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [Vitest](https://vitest.dev/) - 快速单元测试框架

---

## 📞 支持与反馈

- **问题反馈**: [GitHub Issues](https://github.com/ismoyuai/keyvault/issues)
- **功能建议**: [GitHub Discussions](https://github.com/ismoyuai/keyvault/discussions)
- **安全漏洞**: 请通过私有渠道报告

---

## 🔒 安全声明

KeyVault 采用零知识架构设计。我们：

- ✅ 不收集任何用户数据
- ✅ 不存储主密码
- ✅ 不访问您的凭据数据
- ✅ 不跟踪用户行为
- ✅ 开源透明，可审计

您的数据安全是我们的首要任务。

---

<div align="center">

**🔐 KeyVault - 您的密码，您做主**

[下载最新版本](https://github.com/ismoyuai/keyvault/releases) · [查看文档](https://github.com/ismoyuai/keyvault/wiki) · [报告问题](https://github.com/ismoyuai/keyvault/issues)

</div>
