import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useClipboard } from './useClipboard'

export function useAutoLock() {
  const router = useRouter()
  const auth = useAuthStore()
  const settings = useSettingsStore()
  const { clearClipboard } = useClipboard()
  const timer = ref(null)

  function resetTimer() {
    if (timer.value) clearTimeout(timer.value)
    const minutes = settings.autoLockMinutes || 15
    timer.value = setTimeout(() => {
      lock()
    }, minutes * 60 * 1000)
  }

  function lock() {
    clearClipboard()
    auth.lock()
    router.push('/login')
  }

  function handleActivity() {
    resetTimer()
  }

  onMounted(() => {
    resetTimer()
    document.addEventListener('mousemove', handleActivity)
    document.addEventListener('keydown', handleActivity)
    document.addEventListener('click', handleActivity)
  })

  onUnmounted(() => {
    if (timer.value) clearTimeout(timer.value)
    document.removeEventListener('mousemove', handleActivity)
    document.removeEventListener('keydown', handleActivity)
    document.removeEventListener('click', handleActivity)
  })

  // Clear clipboard on window blur (security)
  function handleBlur() {
    clearClipboard()
  }

  onMounted(() => {
    window.addEventListener('blur', handleBlur)
  })

  onUnmounted(() => {
    window.removeEventListener('blur', handleBlur)
  })

  return { lock, resetTimer }
}
