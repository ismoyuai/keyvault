const { Tray, Menu, nativeImage } = require('electron')

let tray = null

function createTray(mainWindow, onLock, onExit) {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('KeyVault')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => { mainWindow.show(); mainWindow.focus() }
    },
    { type: 'separator' },
    {
      label: '锁定',
      click: () => { onLock(); mainWindow.hide() }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => { if (onExit) onExit(); else mainWindow.destroy() }
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow.isVisible()) mainWindow.focus()
    else mainWindow.show()
  })
}

function destroyTray() {
  if (tray) { tray.destroy(); tray = null }
}

module.exports = { createTray, destroyTray }
