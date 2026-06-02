import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const autoLockMinutes = ref(15)
  const clipboardClearSeconds = ref(30)
  const theme = ref('dark')
  const webdav = ref(null)

  async function loadSettings() {
    const settings = await window.keyvault.settings.get()
    autoLockMinutes.value = settings.autoLockMinutes
    clipboardClearSeconds.value = settings.clipboardClearSeconds
    theme.value = settings.theme
    webdav.value = settings.webdav
  }

  async function updateSettings(data) {
    await window.keyvault.settings.update(data)
    await loadSettings()
  }

  return {
    autoLockMinutes, clipboardClearSeconds, theme, webdav,
    loadSettings, updateSettings
  }
})
