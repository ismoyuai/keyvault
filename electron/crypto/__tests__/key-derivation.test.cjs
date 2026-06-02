const { generateSalt, deriveKey, hashPassword, verifyPassword, extractSalt } = require('../../../src/crypto/key-derivation.cjs')

describe('key-derivation.cjs', () => {
  describe('generateSalt', () => {
    it('should return a 16-byte Buffer', () => {
      const salt = generateSalt()
      expect(Buffer.isBuffer(salt)).toBe(true)
      expect(salt.length).toBe(16)
    })

    it('should return different salts each time', () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      expect(salt1.equals(salt2)).toBe(false)
    })
  })

  describe('hashPassword / verifyPassword', () => {
    it('should return true for correct password', async () => {
      const stored = await hashPassword('mySecret123')
      const result = await verifyPassword('mySecret123', stored)
      expect(result).toBe(true)
    })

    it('should return false for wrong password', async () => {
      const stored = await hashPassword('mySecret123')
      const result = await verifyPassword('wrongPassword', stored)
      expect(result).toBe(false)
    })

    it('should produce hash in argon2id$<salt>$<hash> format', async () => {
      const stored = await hashPassword('test')
      const parts = stored.split('$')
      expect(parts.length).toBe(3)
      expect(parts[0]).toBe('argon2id')
      // salt and hash parts should be valid base64
      expect(() => Buffer.from(parts[1], 'base64')).not.toThrow()
      expect(() => Buffer.from(parts[2], 'base64')).not.toThrow()
      // decoded salt should be 16 bytes
      const salt = Buffer.from(parts[1], 'base64')
      expect(salt.length).toBe(16)
    })

    it('should produce different hashes for same password (different salts)', async () => {
      const hash1 = await hashPassword('samePassword')
      const hash2 = await hashPassword('samePassword')
      expect(hash1).not.toBe(hash2)
      // Both should still verify correctly
      expect(await verifyPassword('samePassword', hash1)).toBe(true)
      expect(await verifyPassword('samePassword', hash2)).toBe(true)
    })

    it('should return false for malformed stored hash', async () => {
      expect(await verifyPassword('test', 'not-a-valid-hash')).toBe(false)
      expect(await verifyPassword('test', 'argon2id$onlyonepart')).toBe(false)
      expect(await verifyPassword('test', 'wrongalgo$salt$hash')).toBe(false)
    })
  })

  describe('extractSalt', () => {
    it('should extract a 16-byte salt from a valid hash', async () => {
      const stored = await hashPassword('test')
      const salt = extractSalt(stored)
      expect(Buffer.isBuffer(salt)).toBe(true)
      expect(salt.length).toBe(16)
    })

    it('should return the same salt that was used to hash', async () => {
      const stored = await hashPassword('test')
      const extracted = extractSalt(stored)
      // Verify that re-hashing with the extracted salt produces a valid password
      const result = await verifyPassword('test', stored)
      expect(result).toBe(true)
      // The extracted salt should match the base64 portion of the stored hash
      const parts = stored.split('$')
      expect(extracted.toString('base64')).toBe(parts[1])
    })

    it('should throw on invalid format - not enough parts', () => {
      expect(() => extractSalt('argon2id$onlyone')).toThrow('Invalid hash format')
    })

    it('should throw on invalid format - wrong algorithm prefix', () => {
      expect(() => extractSalt('bcrypt$salt$hash')).toThrow('Invalid hash format')
    })

    it('should throw on completely invalid string', () => {
      expect(() => extractSalt('garbage')).toThrow('Invalid hash format')
    })
  })

  describe('deriveKey', () => {
    it('should derive a 32-byte key', async () => {
      const salt = generateSalt()
      const key = await deriveKey('password', salt)
      expect(Buffer.isBuffer(key)).toBe(true)
      expect(key.length).toBe(32)
    })

    it('should produce the same key for same password and salt', async () => {
      const salt = generateSalt()
      const key1 = await deriveKey('password', salt)
      const key2 = await deriveKey('password', salt)
      expect(key1.equals(key2)).toBe(true)
    })

    it('should produce different keys for different salts', async () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      const key1 = await deriveKey('password', salt1)
      const key2 = await deriveKey('password', salt2)
      expect(key1.equals(key2)).toBe(false)
    })

    it('should produce different keys for different passwords', async () => {
      const salt = generateSalt()
      const key1 = await deriveKey('password1', salt)
      const key2 = await deriveKey('password2', salt)
      expect(key1.equals(key2)).toBe(false)
    })

    it('should throw on empty password', async () => {
      const salt = generateSalt()
      await expect(deriveKey('', salt)).rejects.toThrow('Password cannot be empty')
    })

    it('should throw on null password', async () => {
      const salt = generateSalt()
      await expect(deriveKey(null, salt)).rejects.toThrow('Password cannot be empty')
    })

    it('should throw on invalid salt - not a Buffer', async () => {
      await expect(deriveKey('password', 'not-a-buffer')).rejects.toThrow('Salt must be a 16-byte Buffer')
    })

    it('should throw on invalid salt - wrong length', async () => {
      await expect(deriveKey('password', Buffer.alloc(8))).rejects.toThrow('Salt must be a 16-byte Buffer')
    })
  })
})
