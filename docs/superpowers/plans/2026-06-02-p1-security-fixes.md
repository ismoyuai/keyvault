# P1: 安全紧急修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除所有已知安全漏洞，不改变功能行为。

**Architecture:** 修复 zeroBuffer 导入、添加 CSP 头、加密 WebDAV 凭据、加固 Electron 权限控制。同步编写核心加密模块的单元测试。

**Tech Stack:** Electron 42, Node.js crypto, Vitest

---

## File Map

| 操作 | 文件 | 职责 |
|---|---|---|
| Modify | `electron/main.js` | 修复 zeroBuffer 导入、添加 CSP、权限控制 |
| Modify | `electron/preload.cjs` | 添加 audit IPC 通道（为 P3 预留） |
| Create | `electron/crypto/__tests__/encryption.test.cjs` | 加密模块测试 |
| Create | `electron/crypto/__tests__/key-derivation.test.cjs` | 密钥派生模块测试 |
| Create | `vitest.config.js` | Vitest 配置 |
| Modify | `package.json` | 添加 vitest 依赖和 test 脚本 |

---

### Task 1: 安装 Vitest 并配置测试环境

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`

- [ ] **Step 1: 安装 vitest 依赖**

```bash
cd D:/keyvault
npm install --save-dev vitest
```

- [ ] **Step 2: 创建 vitest 配置文件**

Create `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/__tests__/**/*.test.{js,cjs}'],
    globals: true,
    testTimeout: 30000, // Argon2id 需要较长时间
  },
})
```

- [ ] **Step 3: 添加 test 脚本到 package.json**

Modify `package.json` scripts section, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 运行测试确认配置正确**

```bash
npx vitest run
```

Expected: `No test files found` (还没有测试文件，但 vitest 启动成功)

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.js package-lock.json
git commit -m "chore: add vitest testing framework"
```

---

### Task 2: 为 encryption.cjs 编写单元测试

**Files:**
- Create: `electron/crypto/__tests__/encryption.test.cjs`

- [ ] **Step 1: 创建测试目录**

```bash
mkdir -p D:/keyvault/electron/crypto/__tests__
```

- [ ] **Step 2: 编写加密模块测试**

Create `electron/crypto/__tests__/encryption.test.cjs`:

```javascript
const { describe, it, expect } = require('vitest')
const { encrypt, decrypt, encryptField, decryptField, zeroBuffer } = require('../encryption.cjs')
const crypto = require('crypto')

describe('encryption.cjs', () => {
  const testKey = crypto.randomBytes(32)

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt roundtrip correctly', () => {
      const plaintext = 'Hello, KeyVault!'
      const encrypted = encrypt(plaintext, testKey)
      const decrypted = decrypt(encrypted, testKey)
      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertext for same plaintext (random nonce)', () => {
      const plaintext = 'same message'
      const a = encrypt(plaintext, testKey)
      const b = encrypt(plaintext, testKey)
      expect(a.equals(b)).toBe(false)
    })

    it('should throw on empty key', () => {
      expect(() => encrypt('test', Buffer.alloc(0))).toThrow('Key must be a 32-byte Buffer')
    })

    it('should throw on wrong key length', () => {
      expect(() => encrypt('test', crypto.randomBytes(16))).toThrow('Key must be a 32-byte Buffer')
    })

    it('should throw on tampered ciphertext', () => {
      const encrypted = encrypt('test', testKey)
      // Flip a byte in the ciphertext portion
      encrypted[encrypted.length - 1] ^= 0xff
      expect(() => decrypt(encrypted, testKey)).toThrow()
    })

    it('should handle empty string', () => {
      const encrypted = encrypt('', testKey)
      const decrypted = decrypt(encrypted, testKey)
      expect(decrypted).toBe('')
    })

    it('should handle unicode text', () => {
      const plaintext = '密码管理器 🔐 émojis'
      const encrypted = encrypt(plaintext, testKey)
      const decrypted = decrypt(encrypted, testKey)
      expect(decrypted).toBe(plaintext)
    })
  })

  describe('encryptField / decryptField', () => {
    it('should return null for null input', () => {
      expect(encryptField(null, testKey)).toBeNull()
      expect(encryptField(undefined, testKey)).toBeNull()
    })

    it('should decryptField return null for null/empty input', () => {
      expect(decryptField(null, testKey)).toBeNull()
      expect(decryptField('', testKey)).toBeNull()
    })

    it('should roundtrip through encryptField/decryptField', () => {
      const value = 'test@example.com'
      const encrypted = encryptField(value, testKey)
      expect(typeof encrypted).toBe('string') // base64
      const decrypted = decryptField(encrypted, testKey)
      expect(decrypted).toBe(value)
    })

    it('should convert numbers to string', () => {
      const encrypted = encryptField(42, testKey)
      const decrypted = decryptField(encrypted, testKey)
      expect(decrypted).toBe('42')
    })
  })

  describe('zeroBuffer', () => {
    it('should fill buffer with zeros', () => {
      const buf = Buffer.from('secret data')
      zeroBuffer(buf)
      expect(buf.every(b => b === 0)).toBe(true)
    })

    it('should handle non-buffer input silently', () => {
      expect(() => zeroBuffer(null)).not.toThrow()
      expect(() => zeroBuffer(undefined)).not.toThrow()
      expect(() => zeroBuffer('string')).not.toThrow()
    })
  })
})
```

- [ ] **Step 3: 运行测试确认通过**

```bash
npx vitest run electron/crypto/__tests__/encryption.test.cjs
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add electron/crypto/__tests__/encryption.test.cjs
git commit -m "test: add unit tests for encryption module"
```

---

### Task 3: 为 key-derivation.cjs 编写单元测试

**Files:**
- Create: `electron/crypto/__tests__/key-derivation.test.cjs`

- [ ] **Step 1: 编写密钥派生模块测试**

Create `electron/crypto/__tests__/key-derivation.test.cjs`:

```javascript
const { describe, it, expect } = require('vitest')
const { generateSalt, deriveKey, hashPassword, verifyPassword, extractSalt } = require('../key-derivation.cjs')

describe('key-derivation.cjs', () => {
  describe('generateSalt', () => {
    it('should return a 16-byte buffer', () => {
      const salt = generateSalt()
      expect(Buffer.isBuffer(salt)).toBe(true)
      expect(salt.length).toBe(16)
    })

    it('should return different salts each time', () => {
      const a = generateSalt()
      const b = generateSalt()
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('hashPassword / verifyPassword', () => {
    it('should hash and verify correctly', async () => {
      const password = 'MyStr0ng!Pass'
      const hash = await hashPassword(password)
      const valid = await verifyPassword(password, hash)
      expect(valid).toBe(true)
    })

    it('should reject wrong password', async () => {
      const hash = await hashPassword('correct')
      const valid = await verifyPassword('wrong', hash)
      expect(valid).toBe(false)
    })

    it('should produce argon2id$ format', async () => {
      const hash = await hashPassword('test')
      expect(hash).toMatch(/^argon2id\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
    })

    it('should produce different hashes for same password (different salts)', async () => {
      const a = await hashPassword('same')
      const b = await hashPassword('same')
      expect(a).not.toBe(b)
    })

    it('should handle empty password gracefully', async () => {
      // hashPassword should work (argon2 can hash empty string)
      const hash = await hashPassword('')
      expect(hash).toBeTruthy()
    })
  })

  describe('extractSalt', () => {
    it('should extract salt from valid hash', async () => {
      const hash = await hashPassword('test')
      const salt = extractSalt(hash)
      expect(Buffer.isBuffer(salt)).toBe(true)
      expect(salt.length).toBe(16)
    })

    it('should throw on invalid format', () => {
      expect(() => extractSalt('invalid')).toThrow('Invalid hash format')
      expect(() => extractSalt('')).toThrow('Invalid hash format')
    })
  })

  describe('deriveKey', () => {
    it('should derive a 32-byte key', async () => {
      const salt = generateSalt()
      const key = await deriveKey('password', salt)
      expect(Buffer.isBuffer(key)).toBe(true)
      expect(key.length).toBe(32)
    })

    it('should produce same key for same password+salt', async () => {
      const salt = generateSalt()
      const a = await deriveKey('password', salt)
      const b = await deriveKey('password', salt)
      expect(a.equals(b)).toBe(true)
    })

    it('should throw on empty password', async () => {
      const salt = generateSalt()
      await expect(deriveKey('', salt)).rejects.toThrow('Password cannot be empty')
    })

    it('should throw on invalid salt', async () => {
      await expect(deriveKey('password', Buffer.alloc(8))).rejects.toThrow('Salt must be a 16-byte Buffer')
    })
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

```bash
npx vitest run electron/crypto/__tests__/key-derivation.test.cjs
```

Expected: All tests PASS (Argon2id tests may take a few seconds)

- [ ] **Step 3: Commit**

```bash
git add electron/crypto/__tests__/key-derivation.test.cjs
git commit -m "test: add unit tests for key-derivation module"
```

---

### Task 4: 修复 zeroBuffer 导入 bug

**Files:**
- Modify: `electron/main.js:11`

**问题**：`main.js` 第 11 行从 `key-derivation.cjs` 导入 `zeroBuffer`，但该函数定义在 `encryption.cjs` 中。导入结果为 `undefined`，加密密钥在锁定/密码变更时无法清零。

- [ ] **Step 1: 修复导入路径**

Modify `electron/main.js` line 11-12:

```javascript
// Before (broken):
const { deriveKey, hashPassword, verifyPassword, extractSalt, zeroBuffer } = require('../src/crypto/key-derivation.cjs')
const { encryptField, decryptField } = require('../src/crypto/encryption.cjs')

// After (fixed):
const { deriveKey, hashPassword, verifyPassword, extractSalt } = require('../src/crypto/key-derivation.cjs')
const { encryptField, decryptField, zeroBuffer } = require('../src/crypto/encryption.cjs')
```

- [ ] **Step 2: 验证 zeroBuffer 不再是 undefined**

在 `electron/main.js` 中临时添加日志验证：

```javascript
console.log('zeroBuffer is function:', typeof zeroBuffer === 'function')
```

Expected: `true`

- [ ] **Step 3: 移除验证日志**

删除临时添加的 `console.log` 行。

- [ ] **Step 4: 运行所有测试确认无回归**

```bash
npx vitest run
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/main.js
git commit -m "fix: correct zeroBuffer import from encryption.cjs

zeroBuffer was imported from key-derivation.cjs where it does not exist.
The import resolved to undefined, causing the encryption key to never be
zeroed in memory on lock or password change. Now correctly imported from
encryption.cjs."
```

---

### Task 5: 添加 Content Security Policy

**Files:**
- Modify: `electron/main.js` (createWindow function)

- [ ] **Step 1: 在 createWindow 后添加 CSP 头**

在 `electron/main.js` 的 `app.whenReady()` 中，`createWindow()` 调用之后添加：

```javascript
// ========== Content Security Policy ==========
const { session } = require('electron')

session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:5173; font-src 'self'"
      ]
    }
  })
})
```

注意：`connect-src` 包含 `http://localhost:5173` 是为了开发模式下 Vite HMR 正常工作。生产模式下只会连接 `'self'`。

- [ ] **Step 2: 验证 CSP 生效**

启动应用后，在 DevTools Console 中执行：

```javascript
document.querySelector('meta[http-equiv="Content-Security-Policy"]')
```

Expected: CSP 头已通过 HTTP 响应注入（不在 meta 标签中，而是在 network 层）

- [ ] **Step 3: 运行所有测试确认无回归**

```bash
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add electron/main.js
git commit -m "security: add Content Security Policy headers

CSP restricts script/style/img/connect sources to self only.
unsafe-inline for styles is required by Element Plus dynamic styles.
localhost:5173 in connect-src enables Vite HMR in dev mode."
```

---

### Task 6: 加密 WebDAV 凭据存储

**Files:**
- Modify: `electron/main.js` (sync:configure, sync:push, sync:pull, sync:status handlers)

**当前问题**：WebDAV 用户名/密码明文存储在 `config.json` 中。

**方案**：使用主密码派生的密钥对 WebDAV 凭据进行 AES-256-GCM 加密后存储。读取时在解锁状态下解密。

- [ ] **Step 1: 添加 WebDAV 凭据加密/解密辅助函数**

在 `electron/main.js` 的状态部分之后添加：

```javascript
// ========== WebDAV 凭据加密 ==========
function encryptWebDAVCredentials(webdavConfig) {
  if (!encryptionKey || !webdavConfig) return webdavConfig
  return {
    url: webdavConfig.url, // URL 不加密（非敏感）
    username: encryptField(webdavConfig.username, encryptionKey),
    password: encryptField(webdavConfig.password, encryptionKey),
  }
}

function decryptWebDAVCredentials(encryptedConfig) {
  if (!encryptionKey || !encryptedConfig) return encryptedConfig
  return {
    url: encryptedConfig.url,
    username: decryptField(encryptedConfig.username, encryptionKey),
    password: decryptField(encryptedConfig.password, encryptionKey),
  }
}
```

- [ ] **Step 2: 修改 sync:configure handler 加密存储**

Modify `sync:configure` handler:

```javascript
ipcMain.handle('sync:configure', (event, config) => {
  if (!encryptionKey) throw new Error('未解锁')
  const appConfig = loadConfig()
  appConfig.webdav = encryptWebDAVCredentials(config)
  saveConfig(appConfig)
  return { success: true }
})
```

- [ ] **Step 3: 修改 sync:push handler 解密读取**

Modify `sync:push` handler:

```javascript
ipcMain.handle('sync:push', async () => {
  if (!encryptionKey) throw new Error('未解锁')
  const config = loadConfig()
  if (!config.webdav) throw new Error('请先配置 WebDAV')
  const webdavConfig = decryptWebDAVCredentials(config.webdav)
  createWebDAVClient(webdavConfig)
  const data = exportEncrypted()
  return await push(data, getDeviceIdSafe())
})
```

- [ ] **Step 4: 修改 sync:pull handler 解密读取**

Modify `sync:pull` handler:

```javascript
ipcMain.handle('sync:pull', async () => {
  if (!encryptionKey) throw new Error('未解锁')
  const config = loadConfig()
  if (!config.webdav) throw new Error('请先配置 WebDAV')
  const webdavConfig = decryptWebDAVCredentials(config.webdav)
  createWebDAVClient(webdavConfig)
  const result = await pull()
  if (result.data) importEncrypted(result.data)
  return result
})
```

- [ ] **Step 5: 修改 sync:status handler 解密读取**

Modify `sync:status` handler:

```javascript
ipcMain.handle('sync:status', async () => {
  if (!encryptionKey) return { configured: false }
  const config = loadConfig()
  if (!config.webdav) return { configured: false }
  try {
    const webdavConfig = decryptWebDAVCredentials(config.webdav)
    createWebDAVClient(webdavConfig)
    return { configured: true, ...(await getStatus()) }
  } catch (e) {
    return { configured: true, error: e.message }
  }
})
```

- [ ] **Step 6: 修改 settings:get 不暴露明文 WebDAV 凭据**

Modify `settings:get` handler:

```javascript
ipcMain.handle('settings:get', () => {
  const config = loadConfig()
  return {
    autoLockMinutes: config.autoLockMinutes || 15,
    clipboardClearSeconds: config.clipboardClearSeconds || 30,
    theme: config.theme || 'dark',
    webdav: config.webdav ? { configured: true, url: config.webdav.url } : null,
  }
})
```

- [ ] **Step 7: 运行所有测试确认无回归**

```bash
npx vitest run
```

- [ ] **Step 8: Commit**

```bash
git add electron/main.js
git commit -m "security: encrypt WebDAV credentials at rest

WebDAV username/password are now encrypted with AES-256-GCM using the
master-password-derived key before storage in config.json. Credentials
are only accessible when the vault is unlocked."
```

---

### Task 7: Electron 权限最小化

**Files:**
- Modify: `electron/main.js` (createWindow function)

- [ ] **Step 1: 添加 will-navigate 处理**

在 `createWindow` 函数中，`mainWindow.once('ready-to-show', ...)` 之前添加：

```javascript
// 阻止 renderer 导航到外部 URL
mainWindow.webContents.on('will-navigate', (event, url) => {
  const parsed = new URL(url)
  if (parsed.protocol !== 'file:' && parsed.protocol !== 'devtools:') {
    event.preventDefault()
  }
})
```

- [ ] **Step 2: 添加 setWindowOpenHandler**

在同一位置添加：

```javascript
// 拒绝所有 window.open() 调用
mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
```

- [ ] **Step 3: 添加权限请求处理器**

在 `app.whenReady()` 中，`createWindow()` 之后添加：

```javascript
// 拒绝不需要的权限请求（camera, microphone, notifications 等）
session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
  callback(false)
})
```

- [ ] **Step 4: 添加 sandbox 注释说明**

确保 `sandbox: false` 旁有注释：

```javascript
sandbox: false, // Required: argon2 native module needs Node.js access in main process
```

- [ ] **Step 5: 运行所有测试确认无回归**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add electron/main.js
git commit -m "security: harden Electron permissions

- Block navigation to external URLs
- Deny all window.open() calls
- Reject unnecessary permission requests (camera, microphone, etc.)
- Document sandbox:false rationale"
```

---

### Task 8: 添加 IPC 统一错误格式

**Files:**
- Modify: `electron/main.js` (all IPC handlers)
- Modify: `electron/preload.cjs` (error handling)

**目标**：统一 IPC 错误返回格式，为后续全局错误边界做准备。

- [ ] **Step 1: 创建 IPC 包装函数**

在 `electron/main.js` 的 IPC Handlers 部分之前添加：

```javascript
// ========== IPC 错误处理 ==========
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

- [ ] **Step 2: 包装所有 IPC handler**

将所有 `ipcMain.handle(...)` 调用改为使用 `wrapIPC`。例如：

```javascript
// Before:
ipcMain.handle('auth:unlock', async (event, password) => {
  // ...
})

// After:
ipcMain.handle('auth:unlock', wrapIPC(async (event, password) => {
  // ...
}))
```

对所有 handler 重复此操作。

- [ ] **Step 3: 更新 preload.cjs 中的调用以解包结果**

在 `electron/preload.cjs` 中，更新所有 IPC 调用以解包：

```javascript
// Before:
unlock: (password) => ipcRenderer.invoke('auth:unlock', password),

// After:
unlock: async (password) => {
  const result = await ipcRenderer.invoke('auth:unlock', password)
  if (!result.success) throw new Error(result.error)
  return result.data
},
```

对所有 IPC 方法重复此操作。

- [ ] **Step 4: 运行所有测试确认无回归**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add electron/main.js electron/preload.cjs
git commit -m "refactor: unify IPC error handling with wrapIPC wrapper

All IPC handlers now return { success, data/error } format.
Preload script unwraps results and throws on failure."
```

---

### Task 9: P1 最终验证

- [ ] **Step 1: 运行全部测试**

```bash
npx vitest run
```

Expected: All tests PASS

- [ ] **Step 2: 手动验证清单**

1. 启动应用 `npm start`
2. 设置/解锁 Master Password
3. 添加一个条目
4. 锁定应用
5. 检查 DevTools Console 无 CSP 警告
6. 尝试 `window.open()` 应被阻止

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "chore: P1 security fixes complete

- Fixed zeroBuffer import (encryption.cjs)
- Added CSP headers
- Encrypted WebDAV credentials at rest
- Hardened Electron permissions
- Unified IPC error handling
- Added encryption and key-derivation unit tests"
```
