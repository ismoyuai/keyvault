const { spawn, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const projectRoot = path.join(__dirname, '..')

// Find local electron binary
function getElectronPath() {
  try {
    return require('electron')
  } catch {
    // Fallback: find it manually
    const p = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
    if (fs.existsSync(p)) return p
    throw new Error('Electron not found. Run npm install first.')
  }
}

// Start Vite dev server
console.log('[start] Starting Vite dev server...')
const vite = spawn('npx', ['vite', '--host'], {
  cwd: projectRoot,
  shell: true,
  stdio: 'pipe',
})

let electronStarted = false

vite.stdout.on('data', (data) => {
  const msg = data.toString()
  process.stdout.write('[vite] ' + msg)

  if (msg.includes('5173') && !electronStarted) {
    electronStarted = true
    console.log('[start] Vite ready, launching Electron...')

    const electronPath = getElectronPath()
    const electron = spawn(electronPath, [projectRoot, '--dev'], {
      cwd: projectRoot,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env },
    })

    electron.on('close', () => {
      console.log('[start] Electron closed, shutting down...')
      vite.kill()
      process.exit(0)
    })
  }
})

vite.stderr.on('data', (data) => {
  const msg = data.toString()
  if (!msg.includes('warning')) process.stderr.write('[vite] ' + msg)
})

vite.on('close', (code) => {
  if (!electronStarted) {
    console.error('[start] Vite exited before Electron could start (code: ' + code + ')')
    process.exit(code || 1)
  }
})
