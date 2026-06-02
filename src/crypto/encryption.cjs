const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const NONCE_LENGTH = 12
const TAG_LENGTH = 16

function encrypt(plaintext, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Key must be a 32-byte Buffer')
  if (typeof plaintext !== 'string') throw new Error('Plaintext must be a string')
  const nonce = crypto.randomBytes(NONCE_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([nonce, tag, encrypted])
}

function decrypt(data, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Key must be a 32-byte Buffer')
  if (!Buffer.isBuffer(data) || data.length < NONCE_LENGTH + TAG_LENGTH) throw new Error('Invalid encrypted data')
  const nonce = data.subarray(0, NONCE_LENGTH)
  const tag = data.subarray(NONCE_LENGTH, NONCE_LENGTH + TAG_LENGTH)
  const ciphertext = data.subarray(NONCE_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

function encryptField(value, key) {
  if (value === null || value === undefined) return null
  const encrypted = encrypt(String(value), key)
  return encrypted.toString('base64')
}

function decryptField(encryptedBase64, key) {
  if (!encryptedBase64) return null
  const data = Buffer.from(encryptedBase64, 'base64')
  return decrypt(data, key)
}

function zeroBuffer(buf) {
  if (Buffer.isBuffer(buf)) buf.fill(0)
}

module.exports = { encrypt, decrypt, encryptField, decryptField, zeroBuffer }
