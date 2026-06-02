const argon2 = require('argon2')
const crypto = require('crypto')

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
}

function generateSalt() {
  return crypto.randomBytes(ARGON2_OPTIONS.saltLength)
}

async function deriveKey(password, salt) {
  if (!password || password.length === 0) throw new Error('Password cannot be empty')
  if (!Buffer.isBuffer(salt) || salt.length !== 16) throw new Error('Salt must be a 16-byte Buffer')
  const hash = await argon2.hash(password, { ...ARGON2_OPTIONS, salt: salt, raw: true })
  return Buffer.from(hash)
}

async function hashPassword(password) {
  const salt = generateSalt()
  const hash = await argon2.hash(password, { ...ARGON2_OPTIONS, salt: salt, raw: true })
  const saltB64 = salt.toString('base64')
  const hashB64 = Buffer.from(hash).toString('base64')
  return `argon2id$${saltB64}$${hashB64}`
}

async function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split('$')
    if (parts.length !== 3 || parts[0] !== 'argon2id') return false
    const salt = Buffer.from(parts[1], 'base64')
    const expectedHash = Buffer.from(parts[2], 'base64')
    const actualHash = await argon2.hash(password, { ...ARGON2_OPTIONS, salt: salt, raw: true })
    return crypto.timingSafeEqual(actualHash, expectedHash)
  } catch { return false }
}

function extractSalt(storedHash) {
  const parts = storedHash.split('$')
  if (parts.length !== 3 || parts[0] !== 'argon2id') throw new Error('Invalid hash format')
  return Buffer.from(parts[1], 'base64')
}

module.exports = { generateSalt, deriveKey, hashPassword, verifyPassword, extractSalt }
