import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSyncStore = defineStore('sync', () => {
  const configured = ref(false)
  const lastSyncTime = ref(null)
  const syncing = ref(false)
  const error = ref(null)

  async function checkStatus() {
    const status = await window.keyvault.sync.status()
    configured.value = status.configured
    lastSyncTime.value = status.lastRemoteSync || null
    error.value = status.error || null
  }

  async function configure(config) {
    await window.keyvault.sync.configure(config)
    await checkStatus()
  }

  async function testConnection(config) {
    return await window.keyvault.sync.test(config)
  }

  async function push() {
    syncing.value = true
    error.value = null
    try {
      const result = await window.keyvault.sync.push()
      await checkStatus()
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      syncing.value = false
    }
  }

  async function pull() {
    syncing.value = true
    error.value = null
    try {
      const result = await window.keyvault.sync.pull()
      await checkStatus()
      return result
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      syncing.value = false
    }
  }

  return {
    configured, lastSyncTime, syncing, error,
    checkStatus, configure, testConnection, push, pull
  }
})
