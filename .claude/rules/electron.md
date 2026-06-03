---
paths: ["electron/**"]
---

# Electron 规则

## 模块系统

- 主进程 (`electron/*.js`, `electron/**/*.cjs`): 使用 CJS `require()`
- preload (`electron/preload.cjs`): 使用 CJS，扩展名必须是 `.cjs`
- 所有后端模块扩展名 `.cjs` (crypto, storage, sync, import, utils)

## 安全配置

```javascript
webPreferences: {
  preload: path.join(__dirname, 'preload.cjs'),
  nodeIntegration: false,      // 禁止渲染进程访问 Node.js
  contextIsolation: true,      // preload 脚本隔离
  sandbox: false,              // 必须: argon2 原生模块需要 Node.js
  webSecurity: true,           // 同源策略
}
```

## contextBridge 桥接

- preload.cjs 通过 `contextBridge.exposeInMainWorld('keyvault', {...})` 暴露 API
- 渲染进程通过 `window.keyvault.*` 调用，不能 require 任何模块
- 每个 API 方法用 async/await + unwrap 模式处理错误

## IPC 错误处理

所有 handler 用 `wrapIPC()` 包装:

```javascript
function wrapIPC(handler) {
  return async (event, ...args) => {
    try {
      const result = await handler(event, ...args)
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
}
```

preload 端用 `unwrap(result)` 解包，失败时 throw。

## 密钥安全

- `encryptionKey` 只存在于主进程内存
- 不通过 IPC 传递到渲染进程
- 不写入 config.json 或任何文件
- lockApp() 调用 zeroBuffer(encryptionKey) 后设为 null

## 禁止事项

- ❌ 在渲染进程 require 任何模块
- ❌ 在 IPC 中传递 Buffer 对象 (用 base64 字符串)
- ❌ console.log 输出 encryptionKey 内容
- ❌ 在 config.json 中明文存储 WebDAV 密码 (已加密)
- ❌ 允许 renderer 导航到外部 URL (will-navigate 已拦截)

## Gotchas

1. **sandbox: false 是必须的**: argon2 是原生模块，需要 Node.js 访问。不要尝试开启 sandbox
2. **single instance lock**: app.requestSingleInstanceLock() 防止多开，第二个实例直接退出
3. **窗口焦点事件**: window:focus/window:blur 已发送但未被渲染进程消费，可以忽略
4. **will-navigate**: 只允许 file: 和 devtools: 协议，其他全部拦截
5. **权限请求**: 所有 permission request (camera/microphone 等) 已被拒绝
