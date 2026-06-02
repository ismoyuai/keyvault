import crypto from 'crypto'

const CHARSETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
}

// 易混淆字符
const AMBIGUOUS = 'Il1O0'

/**
 * 生成随机密码
 * @param {Object} options
 * @param {number} options.length - 密码长度 (默认 20)
 * @param {boolean} options.uppercase - 包含大写 (默认 true)
 * @param {boolean} options.lowercase - 包含小写 (默认 true)
 * @param {boolean} options.digits - 包含数字 (默认 true)
 * @param {boolean} options.symbols - 包含特殊字符 (默认 true)
 * @param {boolean} options.excludeAmbiguous - 排除易混淆字符 (默认 false)
 * @returns {string} 生成的密码
 */
export function generatePassword(options = {}) {
  const {
    length = 20,
    uppercase = true,
    lowercase = true,
    digits = true,
    symbols = true,
    excludeAmbiguous = false,
  } = options

  let charset = ''
  const required = []

  if (uppercase) {
    let chars = CHARSETS.uppercase
    if (excludeAmbiguous) chars = chars.replace(/[IO]/g, '')
    charset += chars
    required.push(chars)
  }
  if (lowercase) {
    let chars = CHARSETS.lowercase
    if (excludeAmbiguous) chars = chars.replace(/[l]/g, '')
    charset += chars
    required.push(chars)
  }
  if (digits) {
    let chars = CHARSETS.digits
    if (excludeAmbiguous) chars = chars.replace(/[01]/g, '')
    charset += chars
    required.push(chars)
  }
  if (symbols) {
    charset += CHARSETS.symbols
    required.push(CHARSETS.symbols)
  }

  if (charset.length === 0) {
    throw new Error('至少选择一种字符类型')
  }

  // 使用 crypto 生成安全随机数
  const randomBytes = crypto.randomBytes(length * 2)
  let password = ''

  // 确保每种选中的字符类型至少出现一次
  for (let i = 0; i < required.length && i < length; i++) {
    const chars = required[i]
    password += chars[randomBytes[i] % chars.length]
  }

  // 填充剩余长度
  for (let i = password.length; i < length; i++) {
    password += charset[randomBytes[i + required.length] % charset.length]
  }

  // 打乱顺序 (Fisher-Yates)
  const arr = password.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomBytes[length + i] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr.join('')
}

/**
 * 评估密码强度
 * @param {string} password
 * @returns {{ score: number, level: string, label: string }}
 */
export function evaluateStrength(password) {
  if (!password) return { score: 0, level: 'empty', label: '请输入密码' }

  let score = 0

  // 长度
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1
  if (password.length >= 20) score += 1

  // 字符类型
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^a-zA-Z0-9]/.test(password)) score += 1

  // 多样性
  const unique = new Set(password).size
  if (unique >= 8) score += 1
  if (unique >= 12) score += 1

  const levels = [
    { min: 0, level: 'weak', label: '弱' },
    { min: 3, level: 'fair', label: '一般' },
    { min: 5, level: 'good', label: '良好' },
    { min: 8, level: 'strong', label: '强' },
  ]

  const matched = levels.reverse().find(l => score >= l.min)
  return { score: Math.min(score, 10), ...matched }
}
