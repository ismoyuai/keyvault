const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const {
  initDatabase, closeDatabase, addEntry, getEntry, updateEntry, deleteEntry,
  listEntries, searchEntries, addGroup, listGroups
} = require('../../electron/storage/database.cjs')
const { encryptField, decryptField } = require('../../electron/crypto/encryption.cjs')

describe('integration: full workflow', () => {
  let testKey
  let testDbPath

  beforeEach(async () => {
    testKey = crypto.randomBytes(32)
    testDbPath = path.join(__dirname, `test-integration-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    await initDatabase(testDbPath)
  })

  afterEach(() => {
    closeDatabase()
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
  })

  it('should complete full CRUD workflow', () => {
    // Create group
    const groupId = addGroup('测试分组', 'folder', testKey)
    expect(groupId).toBeTruthy()

    // Create entry
    const entryId = addEntry({
      title: 'GitHub',
      username: 'user@example.com',
      password: 'MyStr0ng!Pass',
      url: 'https://github.com',
      type: 'password',
      group_id: groupId,
    }, testKey)
    expect(entryId).toBeTruthy()

    // Read entry
    const entry = getEntry(entryId, testKey)
    expect(entry.title).toBe('GitHub')
    expect(entry.username).toBe('user@example.com')
    expect(entry.password).toBe('MyStr0ng!Pass')
    expect(entry.url).toBe('https://github.com')

    // Update entry
    updateEntry(entryId, { title: 'GitHub Updated' }, testKey)
    const updated = getEntry(entryId, testKey)
    expect(updated.title).toBe('GitHub Updated')

    // Search
    const results = searchEntries('git', testKey)
    expect(results.length).toBe(1)
    expect(results[0].id).toBe(entryId)

    // Delete
    deleteEntry(entryId)
    const deleted = getEntry(entryId, testKey)
    expect(deleted).toBeNull()

    // List should be empty
    const all = listEntries(testKey, {})
    expect(all.length).toBe(0)
  })

  it('should handle multiple entries and groups', () => {
    addGroup('Group A', 'folder', testKey)
    addGroup('Group B', 'key', testKey)

    addEntry({ title: 'Entry 1', password: 'p1', type: 'password' }, testKey)
    addEntry({ title: 'Entry 2', password: 'p2', type: 'apikey' }, testKey)
    addEntry({ title: 'Entry 3', password: 'p3', type: 'password' }, testKey)

    const all = listEntries(testKey, {})
    expect(all.length).toBe(3)

    const groups = listGroups(testKey)
    expect(groups.length).toBeGreaterThanOrEqual(2)
  })

  it('should encrypt and decrypt fields correctly', () => {
    const plaintext = '敏感数据 🔐'
    const encrypted = encryptField(plaintext, testKey)
    expect(encrypted).not.toBe(plaintext)
    const decrypted = decryptField(encrypted, testKey)
    expect(decrypted).toBe(plaintext)
  })
})
