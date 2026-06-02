const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const {
  initDatabase, closeDatabase, addEntry, addEntries, getEntry, updateEntry, deleteEntry,
  listEntries, searchEntries, addGroup, listGroups, deleteGroup,
  getSetting, setSetting, beginTransaction, commit, rollback, purgeDeleted
} = require('../database.cjs')

describe('database.cjs', () => {
  let testKey
  let testDbPath

  beforeEach(async () => {
    testKey = crypto.randomBytes(32)
    testDbPath = path.join(__dirname, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    await initDatabase(testDbPath)
  })

  afterEach(() => {
    closeDatabase()
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
  })

  describe('entries CRUD', () => {
    it('should add and get an entry', () => {
      const id = addEntry({ title: 'Test', password: 'pass123', type: 'password' }, testKey)
      const entry = getEntry(id, testKey)
      expect(entry).toBeTruthy()
      expect(entry.title).toBe('Test')
      expect(entry.password).toBe('pass123')
    })

    it('should update an entry', () => {
      const id = addEntry({ title: 'Old', password: 'pass' }, testKey)
      updateEntry(id, { title: 'New' }, testKey)
      const entry = getEntry(id, testKey)
      expect(entry.title).toBe('New')
    })

    it('should soft delete an entry', () => {
      const id = addEntry({ title: 'Delete me', password: 'pass' }, testKey)
      deleteEntry(id)
      const entry = getEntry(id, testKey)
      expect(entry).toBeNull()
    })

    it('should list entries with filters', () => {
      addEntry({ title: 'A', password: 'p', type: 'password' }, testKey)
      addEntry({ title: 'B', password: 'p', type: 'apikey' }, testKey)
      addEntry({ title: 'C', password: 'p', type: 'password' }, testKey)

      const all = listEntries(testKey, {})
      expect(all.length).toBe(3)

      const passwords = listEntries(testKey, { type: 'password' })
      expect(passwords.length).toBe(2)
    })

    it('should search entries', () => {
      addEntry({ title: 'GitHub', password: 'pass', url: 'https://github.com' }, testKey)
      addEntry({ title: 'Google', password: 'pass', url: 'https://google.com' }, testKey)

      const results = searchEntries('git', testKey)
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('GitHub')
    })
  })

  describe('batch operations', () => {
    it('should batch insert entries', () => {
      const data = [
        { title: 'A', password: 'p1' },
        { title: 'B', password: 'p2' },
        { title: 'C', password: 'p3' },
      ]
      const ids = addEntries(data, testKey)
      expect(ids.length).toBe(3)

      const all = listEntries(testKey, {})
      expect(all.length).toBe(3)
    })
  })

  describe('groups', () => {
    it('should add and list groups', () => {
      addGroup('Test Group', 'folder', testKey)
      const groups = listGroups(testKey)
      expect(groups.length).toBeGreaterThan(0)
      expect(groups.some(g => g.name === 'Test Group')).toBe(true)
    })

    it('should delete group and reassign entries', () => {
      const groupId = addGroup('Delete Me', 'folder', testKey)
      addEntry({ title: 'In Group', password: 'p', group_id: groupId }, testKey)

      deleteGroup(groupId)

      const entry = listEntries(testKey, {})[0]
      expect(entry.group_id).toBe('default')
    })
  })

  describe('settings', () => {
    it('should get and set settings', () => {
      setSetting('test_key', 'test_value')
      expect(getSetting('test_key')).toBe('test_value')
    })

    it('should return null for missing key', () => {
      expect(getSetting('nonexistent')).toBeNull()
    })
  })

  describe('transactions', () => {
    it('should commit transaction', () => {
      beginTransaction()
      commit()
      // After committing, normal operations should work fine
      addEntry({ title: 'In Tx', password: 'p' }, testKey)
      expect(listEntries(testKey, {}).length).toBe(1)
    })
  })

  describe('purgeDeleted', () => {
    it('should not throw when purging', () => {
      const id = addEntry({ title: 'Old', password: 'p' }, testKey)
      deleteEntry(id)
      expect(() => purgeDeleted(30)).not.toThrow()
    })
  })
})
