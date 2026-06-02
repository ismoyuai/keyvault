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
    return currentEntry.value
  }

  async function addEntry(data) {
    const id = await window.keyvault.entries.add(data)
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
    entries.value = await window.keyvault.entries.search(query)
  }

  return {
    entries, currentEntry, loading,
    loadEntries, loadEntry, addEntry, updateEntry, deleteEntry, searchEntries
  }
})
