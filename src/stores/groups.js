import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref([])
  const activeGroupId = ref(null)

  async function loadGroups() {
    groups.value = await window.keyvault.groups.list()
  }

  async function addGroup(name, icon) {
    const id = await window.keyvault.groups.add(name, icon)
    await loadGroups()
    return id
  }

  async function deleteGroup(id) {
    await window.keyvault.groups.delete(id)
    await loadGroups()
  }

  function setActiveGroup(id) {
    activeGroupId.value = id
  }

  return { groups, activeGroupId, loadGroups, addGroup, deleteGroup, setActiveGroup }
})
