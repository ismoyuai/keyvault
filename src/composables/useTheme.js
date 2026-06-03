import { ref, onMounted, onUnmounted } from 'vue'

const currentTheme = ref('dark')
const themePreference = ref('system')

export function useTheme() {
  let mediaQuery = null
  let handleChange = null

  function applyTheme(theme) {
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme
    currentTheme.value = resolved
    document.documentElement.setAttribute('data-theme', resolved)
  }

  async function init() {
    try {
      const saved = await window.keyvault.theme.get()
      themePreference.value = saved
      applyTheme(saved)
    } catch {
      applyTheme('system')
    }

    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    handleChange = () => {
      if (themePreference.value === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handleChange)

    if (window.keyvault.theme.onChange) {
      window.keyvault.theme.onChange((_event, theme) => {
        applyTheme(theme)
      })
    }
  }

  async function setTheme(theme) {
    themePreference.value = theme
    applyTheme(theme)
    try {
      await window.keyvault.theme.set(theme)
    } catch {}
  }

  onUnmounted(() => {
    if (mediaQuery && handleChange) {
      mediaQuery.removeEventListener('change', handleChange)
    }
  })

  return {
    currentTheme,
    themePreference,
    init,
    setTheme,
  }
}
