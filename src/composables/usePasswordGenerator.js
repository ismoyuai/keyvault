import { ref } from 'vue'

export function usePasswordGenerator() {
  const password = ref('')
  const length = ref(16)
  const options = ref({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  })

  const charset = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  }

  function generate() {
    let chars = ''
    if (options.value.uppercase) chars += charset.uppercase
    if (options.value.lowercase) chars += charset.lowercase
    if (options.value.numbers) chars += charset.numbers
    if (options.value.symbols) chars += charset.symbols

    if (!chars) {
      chars = charset.lowercase
    }

    const array = new Uint32Array(length.value)
    crypto.getRandomValues(array)
    password.value = Array.from(array, x => chars[x % chars.length]).join('')
    return password.value
  }

  function evaluateStrength(pwd) {
    const p = pwd || password.value
    if (!p) return { score: 0, level: 'weak', label: '' }
    let s = 0
    if (p.length >= 8) s++
    if (p.length >= 12) s++
    if (p.length >= 16) s++
    if (/[a-z]/.test(p)) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^a-zA-Z0-9]/.test(p)) s++
    if (new Set(p).size >= 8) s++

    const levels = [
      { min: 0, level: 'weak', label: '弱' },
      { min: 3, level: 'fair', label: '一般' },
      { min: 5, level: 'good', label: '良好' },
      { min: 7, level: 'strong', label: '强' },
    ]
    const matched = [...levels].reverse().find(l => s >= l.min)
    return { score: Math.min(s, 10), ...matched }
  }

  return { password, length, options, generate, evaluateStrength }
}
