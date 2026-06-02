const { encrypt, decrypt, encryptField, decryptField, zeroBuffer } = require('../../../src/crypto/encryption.cjs')
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
      expect(typeof encrypted).toBe('string')
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
