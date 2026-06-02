import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isUnlocked = ref(false)
  const isSetup = ref(false)

  async function checkSetup() {
    isSetup.value = await window.keyvault.auth.isSetup()
  }

  async function unlock(password) {
    await window.keyvault.auth.unlock(password)
    isUnlocked.value = true
    window.__keyvault_unlocked = true
  }

  async function setup(password) {
    await window.keyvault.auth.setup(password)
    isUnlocked.value = true
    isSetup.value = true
    window.__keyvault_unlocked = true
  }

  function lock() {
    isUnlocked.value = false
    window.__keyvault_unlocked = false
    window.keyvault.auth.lock()
  }

  return { isUnlocked, isSetup, checkSetup, unlock, setup, lock }
})
