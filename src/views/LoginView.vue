<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-logo">🔐</div>
      <h1 class="login-title">KeyVault</h1>
      <p class="login-subtitle">{{ auth.isSetup ? '输入 Master Password 解锁' : '设置 Master Password' }}</p>

      <div class="login-form">
        <div class="input-group">
          <input
            ref="passwordInput"
            v-model="password"
            type="password"
            placeholder="Master Password"
            class="login-input"
            @keyup.enter="handleSubmit"
            autofocus
          />
        </div>

        <div v-if="!auth.isSetup" class="input-group">
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="确认 Master Password"
            class="login-input"
            @keyup.enter="handleSubmit"
          />
        </div>

        <!-- 密码强度指示器 -->
        <div v-if="!isSetup && password" class="strength-bar">
          <div class="strength-fill" :class="strength.level" :style="{ width: strength.score * 10 + '%' }"></div>
        </div>
        <div v-if="!isSetup && password" class="strength-label" :class="strength.level">
          {{ strength.label }}
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button class="login-btn" @click="handleSubmit" :disabled="loading">
          {{ loading ? '处理中...' : (auth.isSetup ? '解锁' : '创建') }}
        </button>
      </div>

      <div class="login-footer">
        <span class="footer-text">AES-256-GCM 加密 · 数据仅存本地</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const passwordInput = ref(null)

// 密码强度评估
const strength = computed(() => {
  const pwd = password.value
  if (!pwd) return { score: 0, level: 'empty', label: '' }
  let s = 0
  if (pwd.length >= 8) s++
  if (pwd.length >= 12) s++
  if (pwd.length >= 16) s++
  if (/[a-z]/.test(pwd)) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/[0-9]/.test(pwd)) s++
  if (/[^a-zA-Z0-9]/.test(pwd)) s++
  if (new Set(pwd).size >= 8) s++
  const levels = [
    { min: 0, level: 'weak', label: '弱' },
    { min: 3, level: 'fair', label: '一般' },
    { min: 5, level: 'good', label: '良好' },
    { min: 7, level: 'strong', label: '强' },
  ]
  const matched = [...levels].reverse().find(l => s >= l.min)
  return { score: Math.min(s, 10), ...matched }
})

onMounted(async () => {
  await auth.checkSetup()
  await nextTick()
  passwordInput.value?.focus()
})

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    if (auth.isSetup) {
      await auth.unlock(password.value)
    } else {
      if (password.value.length < 8) {
        error.value = '密码至少需要 8 个字符'
        return
      }
      if (password.value !== confirmPassword.value) {
        error.value = '两次输入的密码不一致'
        return
      }
      await auth.setup(password.value)
    }
    router.push('/app')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}
.login-box {
  width: 380px;
  text-align: center;
}
.login-logo {
  font-size: 64px;
  margin-bottom: 16px;
}
.login-title {
  font-size: 28px;
  color: var(--text-primary);
  font-weight: 600;
  margin-bottom: 8px;
}
.login-subtitle {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 32px;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.input-group { position: relative; }
.login-input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s;
}
.login-input:focus {
  border-color: var(--accent);
}
.strength-bar {
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}
.strength-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s, background 0.3s;
}
.strength-fill.weak { background: #f56c6c; }
.strength-fill.fair { background: #e6a23c; }
.strength-fill.good { background: #409eff; }
.strength-fill.strong { background: #67c23a; }
.strength-label { font-size: 12px; text-align: right; }
.strength-label.weak { color: #f56c6c; }
.strength-label.fair { color: #e6a23c; }
.strength-label.good { color: #409eff; }
.strength-label.strong { color: #67c23a; }

.error-msg {
  color: #f56c6c;
  font-size: 13px;
  text-align: center;
}
.login-btn {
  padding: 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.login-btn:hover { background: var(--accent-hover); }
.login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.login-footer { margin-top: 32px; }
.footer-text { color: var(--text-secondary); font-size: 12px; }
</style>
