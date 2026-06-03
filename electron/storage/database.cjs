const initSqlJs = require('sql.js')
const path = require('path')
const fs = require('fs')
const { encryptField, decryptField } = require('../crypto/encryption.cjs')
const { v4: uuidv4 } = require('uuid')

let db = null
let dbPath = null

async function initDatabase(filePath) {
  dbPath = filePath
  const SQL = await initSqlJs()

  // Load existing database file if it exists
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY, type TEXT NOT NULL DEFAULT 'password',
      title_encrypted TEXT NOT NULL, username_encrypted TEXT,
      password_encrypted TEXT NOT NULL, url_encrypted TEXT,
      notes_encrypted TEXT, group_id TEXT DEFAULT 'default',
      tags_encrypted TEXT, favorite INTEGER DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL, deleted INTEGER DEFAULT 0
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY, name_encrypted TEXT NOT NULL,
      icon TEXT DEFAULT 'folder', sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)
  db.run(`CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  db.run(`
    CREATE TABLE IF NOT EXISTS import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT,
      file_hash TEXT, record_count INTEGER, imported_at TEXT NOT NULL
    )
  `)
  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)

  // Migrations: add new columns if missing
  const columns = queryAll("PRAGMA table_info(entries)").map(c => c.name)
  if (!columns.includes('template_id')) {
    db.run("ALTER TABLE entries ADD COLUMN template_id TEXT DEFAULT ''")
  }
  if (!columns.includes('custom_fields_encrypted')) {
    db.run("ALTER TABLE entries ADD COLUMN custom_fields_encrypted TEXT")
  }
  if (!columns.includes('last_accessed_at')) {
    db.run("ALTER TABLE entries ADD COLUMN last_accessed_at TEXT")
  }

  db.run('CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type)')
  db.run('CREATE INDEX IF NOT EXISTS idx_entries_group ON entries(group_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_entries_favorite ON entries(favorite)')
  db.run('CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(deleted)')

  saveDb()
  return db
}

function saveDb() {
  if (db && dbPath) {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
  }
}

function closeDatabase() {
  if (db) { saveDb(); db.close(); db = null }
}

// Helper: run a query and return results as array of objects
function queryAll(sql, params) {
  const stmt = db.prepare(sql)
  try {
    if (params) stmt.bind(params)
    const results = []
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    return results
  } finally {
    stmt.free()
  }
}

// Helper: run a query and return first row
function queryOne(sql, params) {
  const rows = queryAll(sql, params)
  return rows.length > 0 ? rows[0] : null
}

function addEntry(data, key) {
  const now = new Date().toISOString()
  const id = uuidv4()
  db.run(
    `INSERT INTO entries (id, type, title_encrypted, username_encrypted, password_encrypted,
     url_encrypted, notes_encrypted, group_id, tags_encrypted, favorite,
     created_at, updated_at, device_id, deleted,
     template_id, custom_fields_encrypted, last_accessed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.type || 'password',
     encryptField(data.title, key),
     encryptField(data.username, key),
     encryptField(data.password, key),
     encryptField(data.url, key),
     encryptField(data.notes, key),
     data.group_id || 'default',
     encryptField(JSON.stringify(data.tags || []), key),
     data.favorite ? 1 : 0,
     now, now, data.device_id || 'unknown', 0,
     data.template_id || '',
     encryptField(JSON.stringify(data.custom_fields || { fields: [] }), key),
     null]
  )
  saveDb()
  return id
}

function getEntry(id, key) {
  const row = queryOne('SELECT * FROM entries WHERE id = ? AND deleted = 0', [id])
  return row ? decryptRow(row, key) : null
}

function updateEntry(id, data, key) {
  const now = new Date().toISOString()
  const sets = []
  const params = []

  if (data.title !== undefined) { sets.push('title_encrypted = ?'); params.push(encryptField(data.title, key)) }
  if (data.username !== undefined) { sets.push('username_encrypted = ?'); params.push(encryptField(data.username, key)) }
  if (data.password !== undefined) { sets.push('password_encrypted = ?'); params.push(encryptField(data.password, key)) }
  if (data.url !== undefined) { sets.push('url_encrypted = ?'); params.push(encryptField(data.url, key)) }
  if (data.notes !== undefined) { sets.push('notes_encrypted = ?'); params.push(encryptField(data.notes, key)) }
  if (data.group_id !== undefined) { sets.push('group_id = ?'); params.push(data.group_id) }
  if (data.tags !== undefined) { sets.push('tags_encrypted = ?'); params.push(encryptField(JSON.stringify(data.tags), key)) }
  if (data.favorite !== undefined) { sets.push('favorite = ?'); params.push(data.favorite ? 1 : 0) }
  if (data.custom_fields !== undefined) { sets.push('custom_fields_encrypted = ?'); params.push(encryptField(JSON.stringify(data.custom_fields), key)) }

  sets.push('updated_at = ?')
  params.push(now)
  params.push(id)

  db.run(`UPDATE entries SET ${sets.join(', ')} WHERE id = ?`, params)
  saveDb()
}

function deleteEntry(id) {
  db.run('UPDATE entries SET deleted = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id])
  saveDb()
}

function listEntries(key, filters) {
  filters = filters || {}
  let sql = 'SELECT * FROM entries WHERE deleted = 0'
  const params = []
  if (filters.group_id) { sql += ' AND group_id = ?'; params.push(filters.group_id) }
  if (filters.type) { sql += ' AND type = ?'; params.push(filters.type) }
  if (filters.favorites) { sql += ' AND favorite = 1' }
  sql += ' ORDER BY favorite DESC, updated_at DESC'
  return queryAll(sql, params.length ? params : undefined).map(row => decryptRow(row, key))
}

function searchEntries(query, key) {
  if (!query || query.trim() === '') return listEntries(key)
  const q = query.toLowerCase().trim()
  return listEntries(key).filter(e =>
    (e.title && e.title.toLowerCase().includes(q)) ||
    (e.username && e.username.toLowerCase().includes(q)) ||
    (e.url && e.url.toLowerCase().includes(q)) ||
    (e.notes && e.notes.toLowerCase().includes(q))
  )
}

function exportEncrypted() {
  return {
    version: 1, exported_at: new Date().toISOString(),
    entries: queryAll('SELECT * FROM entries'),
    groups: queryAll('SELECT * FROM groups'),
    settings: queryAll('SELECT * FROM settings'),
  }
}

function importEncrypted(data) {
  for (const entry of data.entries || []) {
    const existing = queryOne('SELECT updated_at FROM entries WHERE id = ?', [entry.id])
    if (!existing || entry.updated_at > existing.updated_at) {
      db.run(`INSERT OR REPLACE INTO entries (id, type, title_encrypted, username_encrypted,
        password_encrypted, url_encrypted, notes_encrypted, group_id, tags_encrypted, favorite,
        created_at, updated_at, device_id, deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [entry.id, entry.type, entry.title_encrypted, entry.username_encrypted,
         entry.password_encrypted, entry.url_encrypted, entry.notes_encrypted,
         entry.group_id, entry.tags_encrypted, entry.favorite,
         entry.created_at, entry.updated_at, entry.device_id, entry.deleted])
    }
  }
  for (const group of data.groups || []) {
    db.run('INSERT OR REPLACE INTO groups (id, name_encrypted, icon, sort_order, created_at) VALUES (?,?,?,?,?)',
      [group.id, group.name_encrypted, group.icon, group.sort_order, group.created_at])
  }
  for (const setting of data.settings || []) {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)', [setting.key, setting.value])
  }
  saveDb()
}

function decryptRow(row, key) {
  try {
    return {
      id: row.id, type: row.type,
      title: decryptField(row.title_encrypted, key),
      username: decryptField(row.username_encrypted, key),
      password: decryptField(row.password_encrypted, key),
      url: decryptField(row.url_encrypted, key),
      notes: decryptField(row.notes_encrypted, key),
      group_id: row.group_id,
      tags: JSON.parse(decryptField(row.tags_encrypted, key) || '[]'),
      favorite: row.favorite === 1,
      created_at: row.created_at, updated_at: row.updated_at,
      device_id: row.device_id,
      template_id: row.template_id || '',
      custom_fields: row.custom_fields_encrypted
        ? JSON.parse(decryptField(row.custom_fields_encrypted, key) || '{"fields":[]}')
        : { fields: [] },
      last_accessed_at: row.last_accessed_at || null,
    }
  } catch {
    return { id: row.id, type: row.type, title: '[解密失败]', username: '', password: '',
      url: '', notes: '', group_id: row.group_id, tags: [], favorite: false,
      created_at: row.created_at, updated_at: row.updated_at, device_id: row.device_id,
      template_id: row.template_id || '', custom_fields: { fields: [] },
      last_accessed_at: row.last_accessed_at || null }
  }
}

function addGroup(name, icon, key) {
  const now = new Date().toISOString()
  const id = uuidv4()
  db.run('INSERT INTO groups (id, name_encrypted, icon, sort_order, created_at) VALUES (?,?,?,?,?)',
    [id, encryptField(name, key), icon || 'folder', 0, now])
  saveDb()
  return id
}

function listGroups(key) {
  return queryAll('SELECT * FROM groups ORDER BY sort_order, created_at').map(row => ({
    id: row.id, name: decryptField(row.name_encrypted, key), icon: row.icon, sort_order: row.sort_order,
  }))
}

function deleteGroup(id) {
  db.run("UPDATE entries SET group_id = 'default' WHERE group_id = ?", [id])
  db.run('DELETE FROM groups WHERE id = ?', [id])
  saveDb()
}

function getSetting(key) {
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key])
  return row ? row.value : null
}

function setSetting(key, value) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)', [key, value])
  saveDb()
}

function hasImported(fileHash) {
  return !!queryOne('SELECT id FROM import_log WHERE file_hash = ?', [fileHash])
}

function logImport(source, fileHash, count) {
  db.run('INSERT INTO import_log (source, file_hash, record_count, imported_at) VALUES (?,?,?,?)',
    [source, fileHash, count, new Date().toISOString()])
  saveDb()
}

function beginTransaction() {
  db.run('BEGIN TRANSACTION')
}

function commit() {
  db.run('COMMIT')
}

function rollback() {
  db.run('ROLLBACK')
}

function addEntries(dataArray, key) {
  const now = new Date().toISOString()
  beginTransaction()
  try {
    const ids = []
    for (const data of dataArray) {
      const id = uuidv4()
      db.run(
        `INSERT INTO entries (id, type, title_encrypted, username_encrypted, password_encrypted,
         url_encrypted, notes_encrypted, group_id, tags_encrypted, favorite,
         created_at, updated_at, device_id, deleted,
         template_id, custom_fields_encrypted, last_accessed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.type || 'password',
         encryptField(data.title, key),
         encryptField(data.username, key),
         encryptField(data.password, key),
         encryptField(data.url, key),
         encryptField(data.notes, key),
         data.group_id || 'default',
         encryptField(JSON.stringify(data.tags || []), key),
         data.favorite ? 1 : 0,
         now, now, data.device_id || 'unknown', 0,
         data.template_id || '',
         encryptField(JSON.stringify(data.custom_fields || { fields: [] }), key),
         null]
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

function purgeDeleted(olderThanDays = 30) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
  db.run('DELETE FROM entries WHERE deleted = 1 AND updated_at < ?', [cutoff])
  saveDb()
}

function updateLastAccessed(id) {
  const now = new Date().toISOString()
  db.run('UPDATE entries SET last_accessed_at = ? WHERE id = ?', [now, id])
  saveDb()
}

module.exports = {
  initDatabase, closeDatabase, addEntry, addEntries, getEntry, updateEntry, deleteEntry,
  listEntries, searchEntries, exportEncrypted, importEncrypted,
  addGroup, listGroups, deleteGroup, getSetting, setSetting, hasImported, logImport,
  beginTransaction, commit, rollback, purgeDeleted, updateLastAccessed
}
