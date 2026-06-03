const { app, BrowserWindow, ipcMain, clipboard, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

// ========== 安全：禁止多实例 ==========
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit() }

// ========== 核心模块 ==========
const { deriveKey, hashPassword, verifyPassword, extractSalt } = require('./crypto/key-derivation.cjs')
const { encryptField, decryptField, zeroBuffer } = require('./crypto/encryption.cjs')
const { initDatabase, closeDatabase, addEntry, addEntries, getEntry, updateEntry, deleteEntry,
        listEntries, searchEntries, exportEncrypted, importEncrypted,
        addGroup, listGroups, deleteGroup, getSetting, setSetting,
        hasImported, logImport } = require('./storage/database.cjs')
const { getDeviceId } = require('./utils/identity.cjs')
const { createWebDAVClient, testConnection } = require('./sync/webdav-client.cjs')
const { push, pull, getStatus, mergeEntries } = require('./sync/sync-engine.cjs')
const { parseBrowserCSV, deduplicateEntries } = require('./import/browser-csv.cjs')
const { parseTextContent } = require('./import/text-parser.cjs')
const { createTray } = require('./tray.cjs')

// ========== 状态 ==========
let mainWindow = null
let encryptionKey = null
let dbInstance = null
let dbPath = null
let storedPasswordHash = null

// ========== WebDAV 凭据加密 ==========
function encryptWebDAVCredentials(webdavConfig) {
  if (!encryptionKey || !webdavConfig) return webdavConfig
  return {
    url: webdavConfig.url, // URL not encrypted (not sensitive)
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

// ========== 数据目录 ==========
function getDataDir() {
  const dir = path.join(app.getPath('userData'), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getDbPath() { return path.join(getDataDir(), 'keyvault.db') }
function getConfigPath() { return path.join(getDataDir(), 'config.json') }

function loadConfig() {
  try {
    const p = getConfigPath()
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {}
  return {}
}

function saveConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8')
}

// ========== 窗口创建 ==========
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 750, minWidth: 800, minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required: argon2 native module needs Node.js access in main process
      webSecurity: true,
    },
    show: false,
  })

  if (process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Block navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'file:' && parsed.protocol !== 'devtools:') {
      event.preventDefault()
    }
  })

  // Deny all window.open() calls
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('focus', () => mainWindow.webContents.send('window:focus'))
  mainWindow.on('blur', () => mainWindow.webContents.send('window:blur'))

  // System tray
  createTray(mainWindow, lockApp)

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  dbPath = getDbPath()
  const config = loadConfig()
  storedPasswordHash = config.passwordHash || null

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

  // Reject unnecessary permission requests (camera, microphone, notifications, etc.)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false)
  })
})

app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('window-all-closed', () => { lockApp(); app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

function lockApp() {
  if (encryptionKey) { zeroBuffer(encryptionKey); encryptionKey = null }
  if (dbInstance) { closeDatabase(); dbInstance = null }
}

function getDeviceIdSafe() {
  return getDeviceId(
    (k) => getSetting(k),
    (k, v) => setSetting(k, v)
  )
}

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
    const strength = evaluatePasswordStrength(entry.password)
    if (strength.level === 'weak' || strength.level === 'fair') {
      weak.push({ id: entry.id, title: entry.title, reason: `密码强度: ${strength.level}` })
    }

    if (entry.password) {
      if (!duplicateMap.has(entry.password)) {
        duplicateMap.set(entry.password, [])
      }
      duplicateMap.get(entry.password).push({ id: entry.id, title: entry.title })
    }

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

// ========== IPC Handlers ==========

// --- Auth ---
ipcMain.handle('auth:is-setup', wrapIPC(() => !!storedPasswordHash))

ipcMain.handle('auth:setup', wrapIPC(async (event, password) => {
  if (storedPasswordHash) throw new Error('Master Password 已设置')
  storedPasswordHash = await hashPassword(password)
  const config = loadConfig()
  config.passwordHash = storedPasswordHash
  saveConfig(config)
  const salt = extractSalt(storedPasswordHash)
  encryptionKey = await deriveKey(password, salt)
  dbInstance = await initDatabase(dbPath)
  getDeviceIdSafe()
  addGroup('默认', 'folder', encryptionKey)
  addGroup('API Keys', 'key', encryptionKey)
  addGroup('网站账号', 'globe', encryptionKey)
  return { success: true }
}))

ipcMain.handle('auth:unlock', wrapIPC(async (event, password) => {
  if (!storedPasswordHash) throw new Error('请先设置 Master Password')
  const valid = await verifyPassword(password, storedPasswordHash)
  if (!valid) throw new Error('密码错误')
  const salt = extractSalt(storedPasswordHash)
  encryptionKey = await deriveKey(password, salt)
  dbInstance = await initDatabase(dbPath)
  return { success: true }
}))

ipcMain.handle('auth:lock', wrapIPC(() => { lockApp(); return { success: true } }))
ipcMain.handle('auth:is-unlocked', wrapIPC(() => !!encryptionKey))

// --- Entries ---
ipcMain.handle('entries:list', wrapIPC((event, filters) => {
  if (!encryptionKey) throw new Error('未解锁')
  return listEntries(encryptionKey, filters || {})
}))

ipcMain.handle('entries:get', wrapIPC((event, id) => {
  if (!encryptionKey) throw new Error('未解锁')
  return getEntry(id, encryptionKey)
}))

ipcMain.handle('entries:add', wrapIPC((event, data) => {
  if (!encryptionKey) throw new Error('未解锁')
  return addEntry({ ...data, device_id: getDeviceIdSafe() }, encryptionKey)
}))

ipcMain.handle('entries:update', wrapIPC((event, id, data) => {
  if (!encryptionKey) throw new Error('未解锁')
  return updateEntry(id, data, encryptionKey)
}))

ipcMain.handle('entries:delete', wrapIPC((event, id) => {
  if (!encryptionKey) throw new Error('未解锁')
  return deleteEntry(id)
}))

ipcMain.handle('entries:search', wrapIPC((event, query) => {
  if (!encryptionKey) throw new Error('未解锁')
  return searchEntries(query, encryptionKey)
}))

// --- Groups ---
ipcMain.handle('groups:list', wrapIPC(() => {
  if (!encryptionKey) throw new Error('未解锁')
  return listGroups(encryptionKey)
}))

ipcMain.handle('groups:add', wrapIPC((event, name, icon) => {
  if (!encryptionKey) throw new Error('未解锁')
  return addGroup(name, icon, encryptionKey)
}))

ipcMain.handle('groups:delete', wrapIPC((event, id) => {
  if (!encryptionKey) throw new Error('未解锁')
  return deleteGroup(id)
}))

// --- Import ---
ipcMain.handle('import:browser-csv', wrapIPC(async (event, filePath) => {
  if (!encryptionKey) throw new Error('未解锁')
  const content = fs.readFileSync(filePath, 'utf8')
  const hash = crypto.createHash('sha256').update(content).digest('hex')
  if (hasImported(hash)) throw new Error('此文件已导入过')
  const { entries, format } = parseBrowserCSV(content)
  const deduplicated = deduplicateEntries(entries)
  const entriesWithDevice = deduplicated.map(e => ({ ...e, device_id: getDeviceIdSafe() }))
  const ids = addEntries(entriesWithDevice, encryptionKey)
  logImport(format, hash, ids.length)
  return { imported: ids.length, total: entries.length, format }
}))

ipcMain.handle('import:text', wrapIPC(async (event, content) => {
  if (!encryptionKey) throw new Error('未解锁')
  const entries = parseTextContent(content)
  let imported = 0
  for (const entry of entries) {
    addEntry({ ...entry, device_id: getDeviceIdSafe() }, encryptionKey)
    imported++
  }
  logImport('text', crypto.createHash('sha256').update(content).digest('hex'), imported)
  return { imported, total: entries.length }
}))

// --- Sync ---
ipcMain.handle('sync:configure', wrapIPC((event, config) => {
  if (!encryptionKey) throw new Error('未解锁')
  const appConfig = loadConfig()
  appConfig.webdav = encryptWebDAVCredentials(config)
  saveConfig(appConfig)
  return { success: true }
}))

ipcMain.handle('sync:push', wrapIPC(async () => {
  if (!encryptionKey) throw new Error('未解锁')
  const config = loadConfig()
  if (!config.webdav) throw new Error('请先配置 WebDAV')
  const webdavConfig = decryptWebDAVCredentials(config.webdav)
  createWebDAVClient(webdavConfig)
  const data = exportEncrypted()
  const result = await push(data, getDeviceIdSafe(), config.lastSyncTime || null)
  // Update sync time
  config.lastSyncTime = result.exported_at
  saveConfig(config)
  return result
}))

ipcMain.handle('sync:pull', wrapIPC(async () => {
  if (!encryptionKey) throw new Error('未解锁')
  const config = loadConfig()
  if (!config.webdav) throw new Error('请先配置 WebDAV')
  const webdavConfig = decryptWebDAVCredentials(config.webdav)
  createWebDAVClient(webdavConfig)
  const result = await pull()
  if (result.data) {
    if (result.version >= 2) {
      // Incremental sync: merge instead of replace
      const localData = exportEncrypted()
      const { entries } = mergeEntries(localData.entries, result.data.entries || [])
      importEncrypted({ ...result.data, entries })
    } else {
      // v1 full sync compatibility
      importEncrypted(result.data)
    }
  }
  // Update sync time
  const appConfig = loadConfig()
  appConfig.lastSyncTime = new Date().toISOString()
  saveConfig(appConfig)
  return result
}))

ipcMain.handle('sync:test', wrapIPC(async (event, config) => await testConnection(config)))

ipcMain.handle('sync:status', wrapIPC(async () => {
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
}))

// --- Audit ---
ipcMain.handle('audit:passwords', wrapIPC(() => auditPasswords()))

// --- Clipboard ---
ipcMain.handle('clipboard:copy', wrapIPC((event, text) => { clipboard.writeText(text); return true }))

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

nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  }
})

// --- Native Messaging ---
ipcMain.handle('native-messaging:register', wrapIPC(() => {
  const { execSync } = require('child_process')
  const registerScript = path.join(__dirname, 'native-messaging', 'register-host.cjs')
  try {
    execSync(`node "${registerScript}" register`, { stdio: 'pipe' })
    return { success: true }
  } catch (error) {
    throw new Error(`Registration failed: ${error.message}`)
  }
}))

ipcMain.handle('native-messaging:unregister', wrapIPC(() => {
  const { execSync } = require('child_process')
  const registerScript = path.join(__dirname, 'native-messaging', 'register-host.cjs')
  try {
    execSync(`node "${registerScript}" unregister`, { stdio: 'pipe' })
    return { success: true }
  } catch (error) {
    throw new Error(`Unregistration failed: ${error.message}`)
  }
}))

ipcMain.handle('native-messaging:status', wrapIPC(() => {
  const { execSync } = require('child_process')
  const hostName = 'com.keyvault.extension'
  try {
    const chromeResult = execSync(
      `reg query "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${hostName}" 2>nul`,
      { stdio: 'pipe' }
    ).toString()
    const firefoxResult = execSync(
      `reg query "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${hostName}" 2>nul`,
      { stdio: 'pipe' }
    ).toString()
    return {
      chromeRegistered: chromeResult.includes('REG_SZ'),
      firefoxRegistered: firefoxResult.includes('REG_SZ')
    }
  } catch {
    return { chromeRegistered: false, firefoxRegistered: false }
  }
}))

// --- Settings ---
ipcMain.handle('settings:get', wrapIPC(() => {
  const config = loadConfig()
  return {
    autoLockMinutes: config.autoLockMinutes || 15,
    clipboardClearSeconds: config.clipboardClearSeconds || 30,
    theme: config.theme || 'dark',
    webdav: config.webdav ? { configured: true, url: config.webdav.url } : null,
  }
}))

ipcMain.handle('settings:update', wrapIPC((event, data) => {
  const config = loadConfig()
  Object.assign(config, data)
  saveConfig(config)
  return { success: true }
}))

ipcMain.handle('settings:change-password', wrapIPC(async (event, oldPassword, newPassword) => {
  if (!storedPasswordHash) throw new Error('未设置密码')
  const valid = await verifyPassword(oldPassword, storedPasswordHash)
  if (!valid) throw new Error('旧密码错误')
  storedPasswordHash = await hashPassword(newPassword)
  const salt = extractSalt(storedPasswordHash)
  const newKey = await deriveKey(newPassword, salt)
  const config = loadConfig()
  config.passwordHash = storedPasswordHash
  saveConfig(config)
  zeroBuffer(encryptionKey)
  encryptionKey = newKey
  return { success: true }
}))

// --- Window controls ---
ipcMain.handle('window:minimize', wrapIPC(() => { mainWindow?.minimize() }))
ipcMain.handle('window:maximize', wrapIPC(() => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
}))
ipcMain.handle('window:close', wrapIPC(() => { mainWindow?.close() }))

// --- File dialog ---
ipcMain.handle('dialog:open-file', wrapIPC(async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [],
  })
  if (result.canceled) return null
  return result.filePaths[0]
}))
