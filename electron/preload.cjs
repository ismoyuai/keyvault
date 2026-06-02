const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('keyvault', {
  auth: {
    isSetup: () => ipcRenderer.invoke('auth:is-setup'),
    setup: (password) => ipcRenderer.invoke('auth:setup', password),
    unlock: (password) => ipcRenderer.invoke('auth:unlock', password),
    lock: () => ipcRenderer.invoke('auth:lock'),
    isUnlocked: () => ipcRenderer.invoke('auth:is-unlocked'),
  },
  entries: {
    list: (filters) => ipcRenderer.invoke('entries:list', filters),
    get: (id) => ipcRenderer.invoke('entries:get', id),
    add: (data) => ipcRenderer.invoke('entries:add', data),
    update: (id, data) => ipcRenderer.invoke('entries:update', id, data),
    delete: (id) => ipcRenderer.invoke('entries:delete', id),
    search: (query) => ipcRenderer.invoke('entries:search', query),
  },
  groups: {
    list: () => ipcRenderer.invoke('groups:list'),
    add: (name, icon) => ipcRenderer.invoke('groups:add', name, icon),
    delete: (id) => ipcRenderer.invoke('groups:delete', id),
  },
  import: {
    browserCSV: (filePath) => ipcRenderer.invoke('import:browser-csv', filePath),
    text: (content) => ipcRenderer.invoke('import:text', content),
  },
  sync: {
    configure: (config) => ipcRenderer.invoke('sync:configure', config),
    push: () => ipcRenderer.invoke('sync:push'),
    pull: () => ipcRenderer.invoke('sync:pull'),
    test: (config) => ipcRenderer.invoke('sync:test', config),
    status: () => ipcRenderer.invoke('sync:status'),
  },
  clipboard: {
    copy: (text) => ipcRenderer.invoke('clipboard:copy', text),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (data) => ipcRenderer.invoke('settings:update', data),
    changePassword: (oldPwd, newPwd) => ipcRenderer.invoke('settings:change-password', oldPwd, newPwd),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:open-file', options),
  },
  onLock: (callback) => ipcRenderer.on('do:lock', callback),
})
