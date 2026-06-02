const { app, BrowserWindow, ipcMain, clipboard, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

// ========== 安全：禁止多实例 ==========
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit() }

// ========== 核心模块 ==========
const { deriveKey, hashPassword, verifyPassword, extractSalt } = require('../src/crypto/key-derivation.cjs')
const { encryptField, decryptField, zeroBuffer } = require('../src/crypto/encryption.cjs')
const { initDatabase, closeDatabase, addEntry, getEntry, updateEntry, deleteEntry,
        listEntries, searchEntries, exportEncrypted, importEncrypted,
        addGroup, listGroups, deleteGroup, getSetting, setSetting,
        hasImported, logImport } = require('../src/storage/database.cjs')
const { getDeviceId } = require('../src/utils/identity.cjs')
const { createWebDAVClient, testConnection } = require('../src/sync/webdav-client.cjs')
const { push, pull, getStatus } = require('../src/sync/sync-engine.cjs')
const { parseBrowserCSV, deduplicateEntries } = require('../src/import/browser-csv.cjs')
const { parseTextContent } = require('../src/import/text-parser.cjs')

// ========== 状态 ==========
let mainWindow = null
let encryptionKey = null
let dbInstance = null
let dbPath = null
let storedPasswordHash = null

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
      sandbox: false,
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

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('focus', () => mainWindow.webContents.send('window:focus'))
  mainWindow.on('blur', () => mainWindow.webContents.send('window:blur'))
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

// ========== IPC Handlers ==========

// --- Auth ---
ipcMain.handle('auth:is-setup', () => !!storedPasswordHash)

ipcMain.handle('auth:setup', async (event, password) => {
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
})

ipcMain.handle('auth:unlock', async (event, password) => {
  if (!storedPasswordHash) throw new Error('请先设置 Master Password')
  const valid = await verifyPassword(password, storedPasswordHash)
  if (!valid) throw new Error('密码错误')
  const salt = extractSalt(storedPasswordHash)
  encryptionKey = await deriveKey(password, salt)
  dbInstance = await initDatabase(dbPath)
  return { success: true }
})

ipcMain.handle('auth:lock', () => { lockApp(); return { success: true } })
ipcMain.handle('auth:is-unlocked', () => !!encryptionKey)

// --- Entries ---
ipcMain.handle('entries:list', (event, filters) => {
  if (!encryptionKey) throw new Error('未解锁')
  return listEntries(encryptionKey, filters || {})
})

ipcMain.handle('entries:get', (event, id) => {
  if (!encryptionKey) throw new Error('未解锁')
  return getEntry(id, encryptionKey)
})

ipcMain.handle('entries:add', (event, data) => {
  if (!encryptionKey) throw new Error('未解锁')
  return addEntry({ ...data, device_id: getDeviceIdSafe() }, encryptionKey)
})

ipcMain.handle('entries:update', (event, id, data) => {
  if (!encryptionKey) throw new Error('未解锁')
  return updateEntry(id, data, encryptionKey)
})

ipcMain.handle('entries:delete', (event, id) => {
  if (!encryptionKey) throw new Error('未解锁')
  return deleteEntry(id)
})

ipcMain.handle('entries:search', (event, query) => {
  if (!encryptionKey) throw new Error('未解锁')
  return searchEntries(query, encryptionKey)
})

// --- Groups ---
ipcMain.handle('groups:list', () => {
  if (!encryptionKey) throw new Error('未解锁')
  return listGroups(encryptionKey)
})

ipcMain.handle('groups:add', (event, name, icon) => {
  if (!encryptionKey) throw new Error('未解锁')
  return addGroup(name, icon, encryptionKey)
})

ipcMain.handle('groups:delete', (event, id) => {
  if (!encryptionKey) throw new Error('未解锁')
  return deleteGroup(id)
})

// --- Import ---
ipcMain.handle('import:browser-csv', async (event, filePath) => {
  if (!encryptionKey) throw new Error('未解锁')
  const content = fs.readFileSync(filePath, 'utf8')
  const hash = crypto.createHash('sha256').update(content).digest('hex')
  if (hasImported(hash)) throw new Error('此文件已导入过')
  const { entries, format } = parseBrowserCSV(content)
  const deduplicated = deduplicateEntries(entries)
  let imported = 0
  for (const entry of deduplicated) {
    addEntry({ ...entry, device_id: getDeviceIdSafe() }, encryptionKey)
    imported++
  }
  logImport(format, hash, imported)
  return { imported, total: entries.length, format }
})

ipcMain.handle('import:text', async (event, content) => {
  if (!encryptionKey) throw new Error('未解锁')
  const entries = parseTextContent(content)
  let imported = 0
  for (const entry of entries) {
    addEntry({ ...entry, device_id: getDeviceIdSafe() }, encryptionKey)
    imported++
  }
  logImport('text', crypto.createHash('sha256').update(content).digest('hex'), imported)
  return { imported, total: entries.length }
})

// --- Sync ---
ipcMain.handle('sync:configure', (event, config) => {
  const appConfig = loadConfig()
  appConfig.webdav = config
  saveConfig(appConfig)
  return { success: true }
})

ipcMain.handle('sync:push', async () => {
  if (!encryptionKey) throw new Error('未解锁')
  const config = loadConfig()
  if (!config.webdav) throw new Error('请先配置 WebDAV')
  createWebDAVClient(config.webdav)
  const data = exportEncrypted()
  return await push(data, getDeviceIdSafe())
})

ipcMain.handle('sync:pull', async () => {
  if (!encryptionKey) throw new Error('未解锁')
  const config = loadConfig()
  if (!config.webdav) throw new Error('请先配置 WebDAV')
  createWebDAVClient(config.webdav)
  const result = await pull()
  if (result.data) importEncrypted(result.data)
  return result
})

ipcMain.handle('sync:test', async (event, config) => await testConnection(config))

ipcMain.handle('sync:status', async () => {
  const config = loadConfig()
  if (!config.webdav) return { configured: false }
  try {
    createWebDAVClient(config.webdav)
    return { configured: true, ...(await getStatus()) }
  } catch (e) {
    return { configured: true, error: e.message }
  }
})

// --- Clipboard ---
ipcMain.handle('clipboard:copy', (event, text) => { clipboard.writeText(text); return true })

// --- Settings ---
ipcMain.handle('settings:get', () => {
  const config = loadConfig()
  return {
    autoLockMinutes: config.autoLockMinutes || 15,
    clipboardClearSeconds: config.clipboardClearSeconds || 30,
    theme: config.theme || 'dark',
    webdav: config.webdav || null,
  }
})

ipcMain.handle('settings:update', (event, data) => {
  const config = loadConfig()
  Object.assign(config, data)
  saveConfig(config)
  return { success: true }
})

ipcMain.handle('settings:change-password', async (event, oldPassword, newPassword) => {
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
})

// --- Window controls ---
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => mainWindow?.close())

// --- File dialog ---
ipcMain.handle('dialog:open-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [],
  })
  if (result.canceled) return null
  return result.filePaths[0]
})
