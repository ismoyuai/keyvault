import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEntriesStore = defineStore('entries', () => {
  const entries = ref([])
  const currentEntry = ref(null)
  const loading = ref(false)

  async function loadEntries(filters = {}) {
    loading.value = true
    try {
      entries.value = await window.keyvault.entries.list(filters)
    } finally {
      loading.value = false
    }
  }

  async function loadEntry(id) {
    currentEntry.value = await window.keyvault.entries.get(id)
    // 更新最后访问时间（不阻塞返回）
    window.keyvault.entries.updateLastAccessed(id).catch(() => {})
    return currentEntry.value
  }

  async function addEntry(data) {
    const id = await window.keyvault.entries.add({
      type: data.type || 'password',
      template_id: data.template_id || data.type || 'password',
      title: data.title,
      username: data.username || '',
      password: data.password || '',
      url: data.url || '',
      notes: data.notes || '',
      group_id: data.group_id || 'default',
      tags: data.tags || [],
      custom_fields: data.custom_fields || null,
    })
    await loadEntries()
    return id
  }

  async function updateEntry(id, data) {
    await window.keyvault.entries.update(id, data)
    if (currentEntry.value?.id === id) {
      currentEntry.value = await window.keyvault.entries.get(id)
    }
    await loadEntries()
  }

  async function deleteEntry(id) {
    await window.keyvault.entries.delete(id)
    await loadEntries()
  }

  async function searchEntries(query) {
    const results = await window.keyvault.entries.search(query)
    entries.value = results
    return results
  }

  return {
    entries, currentEntry, loading,
    loadEntries, loadEntry, addEntry, updateEntry, deleteEntry, searchEntries
  }
})
