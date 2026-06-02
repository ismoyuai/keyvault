import { ref, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

export function useClipboard() {
  const timer = ref(null)
  const copiedField = ref(null)

  async function copy(text, fieldName = 'text') {
    await window.keyvault.clipboard.copy(text)
    copiedField.value = fieldName

    // Clear previous timer
    if (timer.value) clearTimeout(timer.value)

    // Set new timer
    const settings = useSettingsStore()
    const seconds = settings.clipboardClearSeconds || 30
    timer.value = setTimeout(() => {
      clearClipboard()
    }, seconds * 1000)

    return seconds
  }

  function clearClipboard() {
    window.keyvault.clipboard.copy('')
    copiedField.value = null
    if (timer.value) {
      clearTimeout(timer.value)
      timer.value = null
    }
  }

  onUnmounted(() => {
    if (timer.value) clearTimeout(timer.value)
  })

  return { copy, clearClipboard, copiedField }
}
