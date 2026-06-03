const { contextBridge, ipcRenderer } = require('electron')

function unwrap(result) {
  if (!result.success) throw new Error(result.error)
  return result.data
}

contextBridge.exposeInMainWorld('keyvault', {
  auth: {
    isSetup: async () => unwrap(await ipcRenderer.invoke('auth:is-setup')),
    setup: async (password) => unwrap(await ipcRenderer.invoke('auth:setup', password)),
    unlock: async (password) => unwrap(await ipcRenderer.invoke('auth:unlock', password)),
    lock: async () => unwrap(await ipcRenderer.invoke('auth:lock')),
    isUnlocked: async () => unwrap(await ipcRenderer.invoke('auth:is-unlocked')),
  },
  entries: {
    list: async (filters) => unwrap(await ipcRenderer.invoke('entries:list', filters)),
    get: async (id) => unwrap(await ipcRenderer.invoke('entries:get', id)),
    add: async (data) => unwrap(await ipcRenderer.invoke('entries:add', data)),
    update: async (id, data) => unwrap(await ipcRenderer.invoke('entries:update', id, data)),
    delete: async (id) => unwrap(await ipcRenderer.invoke('entries:delete', id)),
    search: async (query) => unwrap(await ipcRenderer.invoke('entries:search', query)),
  },
  groups: {
    list: async () => unwrap(await ipcRenderer.invoke('groups:list')),
    add: async (name, icon) => unwrap(await ipcRenderer.invoke('groups:add', name, icon)),
    delete: async (id) => unwrap(await ipcRenderer.invoke('groups:delete', id)),
  },
  import: {
    browserCSV: async (filePath) => unwrap(await ipcRenderer.invoke('import:browser-csv', filePath)),
    text: async (content) => unwrap(await ipcRenderer.invoke('import:text', content)),
  },
  sync: {
    configure: async (config) => unwrap(await ipcRenderer.invoke('sync:configure', config)),
    push: async () => unwrap(await ipcRenderer.invoke('sync:push')),
    pull: async () => unwrap(await ipcRenderer.invoke('sync:pull')),
    test: async (config) => unwrap(await ipcRenderer.invoke('sync:test', config)),
    status: async () => unwrap(await ipcRenderer.invoke('sync:status')),
  },
  clipboard: {
    copy: async (text) => unwrap(await ipcRenderer.invoke('clipboard:copy', text)),
  },
  settings: {
    get: async () => unwrap(await ipcRenderer.invoke('settings:get')),
    update: async (data) => unwrap(await ipcRenderer.invoke('settings:update', data)),
    changePassword: async (oldPwd, newPwd) => unwrap(await ipcRenderer.invoke('settings:change-password', oldPwd, newPwd)),
  },
  window: {
    minimize: async () => unwrap(await ipcRenderer.invoke('window:minimize')),
    maximize: async () => unwrap(await ipcRenderer.invoke('window:maximize')),
    close: async () => unwrap(await ipcRenderer.invoke('window:close')),
  },
  audit: {
    passwords: async () => {
      const result = await ipcRenderer.invoke('audit:passwords')
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  },
  theme: {
    get: async () => unwrap(await ipcRenderer.invoke('theme:get')),
    set: async (theme) => unwrap(await ipcRenderer.invoke('theme:set', theme)),
    onChange: (callback) => ipcRenderer.on('theme:changed', callback),
  },
  nativeMessaging: {
    register: async () => unwrap(await ipcRenderer.invoke('native-messaging:register')),
    unregister: async () => unwrap(await ipcRenderer.invoke('native-messaging:unregister')),
    status: async () => unwrap(await ipcRenderer.invoke('native-messaging:status')),
  },
  dialog: {
    openFile: async (options) => unwrap(await ipcRenderer.invoke('dialog:open-file', options)),
  },
  onLock: (callback) => ipcRenderer.on('do:lock', callback),
})
