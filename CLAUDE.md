# KeyVault

本地加密密码与 API Key 管理器 — 零知识架构，数据仅存本地。

## 技术栈

- **前端**: Vue 3 + Pinia + Element Plus + Vite 6
- **后端**: Electron 42 (主进程 CJS)
- **数据库**: sql.js (WASM SQLite)
- **加密**: AES-256-GCM + Argon2id (memoryCost=65536, timeCost=3, parallelism=1)
- **同步**: WebDAV (webdav npm 包)
- **测试**: Vitest

## 命令速查

```bash
npm install          # 安装依赖
npm run dev          # 仅启动 Vite 开发服务器 (端口 5173)
npm run start        # 启动 Vite + Electron 完整应用
npm run test         # 运行所有测试 (vitest run)
npm run test:watch   # 测试监听模式
npm run build        # 仅构建前端 (vite build)
npm run package      # 完整打包 (vite build + electron-rebuild + electron-builder --win)
```

## 目录结构

```
electron/              — Electron 主进程 (CJS, require)
  main.js              — IPC handlers、认证、CRUD、同步入口
  preload.cjs          — contextBridge 安全桥接
  crypto/              — Argon2id 密钥派生 + AES-256-GCM 加解密
  storage/             — sql.js 数据库模块 (WASM)
  sync/                — WebDAV 同步引擎 (增量同步)
  import/              — Chrome/Firefox CSV + 文本解析
  utils/               — 设备标识生成
src/                   — Vue 渲染进程 (ESM, import)
  stores/              — Pinia 状态管理 (auth/entries/groups/settings/sync)
  composables/         — useClipboard, useAutoLock, usePasswordGenerator
  views/               — 6 个页面组件
  layouts/             — MainLayout (侧边栏 + 标题栏)
  router/              — Vue Router (hash 模式)
  styles/              — 全局 CSS (暗色主题变量)
tests/integration/     — 集成测试
docs/superpowers/      — 重构设计文档和实施计划
```

## 安全红线

1. **零知识**: 主密码从不存储，只存 Argon2id 哈希
2. **AES-256-GCM**: 每个字段独立加密，12 字节随机 nonce + 16 字节 auth tag
3. **Argon2id**: 参数 memoryCost=65536, timeCost=3, parallelism=1 — 不可降级
4. **密钥不落盘**: encryptionKey 仅存在于主进程内存，不写入任何文件
5. **内存清零**: lockApp() 必须调用 zeroBuffer(encryptionKey)
6. **CSP**: Content-Security-Policy 限制为 self，仅 style-src 允许 unsafe-inline

## 架构规则

- **主进程 CJS**: `electron/` 下使用 `require()`，文件扩展名 `.cjs`
- **渲染进程 ESM**: `src/` 下使用 `import`，Vite 编译
- **contextBridge 桥接**: 渲染进程通过 `window.keyvault.*` 调用主进程 API
- **IPC 统一错误**: 所有 handler 用 `wrapIPC()` 包装，返回 `{ success, data/error }`
- **Pinia 状态管理**: 组件通过 stores 访问数据，不直接调用 IPC
- **加密在主进程**: 所有 encryptField/decryptField 调用在主进程完成

## 测试规则

- 测试框架: Vitest，配置在 `vitest.config.js`
- 后端测试: `electron/*/\__tests__/*.test.cjs`
- 集成测试: `tests/integration/*.test.cjs`
- 运行: `npm run test` 或 `npx vitest run <路径>`
- 测试超时: 30 秒 (Argon2id 需要较长时间)

## 提交规范

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
