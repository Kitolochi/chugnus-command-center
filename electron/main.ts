import { app, BrowserWindow, Tray, Menu, nativeImage, session } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { initDatabase } from './database'
import { initEmbeddingModel, getEmbeddingStatus } from './embeddings'
import { startHealthMonitor } from './memory-health'
import { loadVectorIndex, rebuildIndex } from './vector-store'
import { registerAllHandlers } from './ipc'
import { scaffoldDomainFolders } from './ipc/system'
import { runDueAgentHeartbeats, pollAgentSessions, setLaunchFn } from './agents'
import { setAgentLaunchFn } from './ipc/agents'
import { shutdownAllProcesses } from './command-center'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// --- Cross-platform terminal launcher helper ---
function launchInExternalTerminal(opts: {
  prompt: string
  cwd: string
  env: NodeJS.ProcessEnv
  title?: string
  allowedTools?: string
}): void {
  const tmpDir = path.join(app.getPath('temp'), 'chugnus-command-center')
  fs.mkdirSync(tmpDir, { recursive: true })
  const safePrompt = opts.prompt.replace(/%/g, '%%').replace(/"/g, "'").replace(/[&|<>^]/g, '^$&')
  const tools = opts.allowedTools || '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"'
  const claudeCmd = `npx --yes @anthropic-ai/claude-code --dangerously-skip-permissions --allowedTools ${tools} -- "${safePrompt}"`

  if (process.platform === 'win32') {
    const batFile = path.join(tmpDir, `launch-${Date.now()}.bat`)
    fs.writeFileSync(batFile, [
      '@echo off',
      `cd /d "${opts.cwd}"`,
      claudeCmd,
    ].join('\r\n'))
    const child = spawn('cmd.exe', ['/c', 'start', `"${(opts.title || '').slice(0, 40)}"`, 'cmd', '/k', batFile], {
      detached: true, stdio: 'ignore', env: opts.env,
    })
    child.unref()
  } else {
    const shFile = path.join(tmpDir, `launch-${Date.now()}.sh`)
    fs.writeFileSync(shFile, [
      '#!/bin/bash',
      `cd "${opts.cwd}"`,
      claudeCmd,
      'exec $SHELL',
    ].join('\n'))
    fs.chmodSync(shFile, 0o755)
    if (process.platform === 'darwin') {
      const child = spawn('open', ['-a', 'Terminal', shFile], {
        detached: true, stdio: 'ignore', env: opts.env,
      })
      child.unref()
    } else {
      const child = spawn('x-terminal-emulator', ['-e', shFile], {
        detached: true, stdio: 'ignore', env: opts.env,
      })
      child.unref()
    }
  }
}

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// Ensure mediaDevices API is available (requires secure context)
if (VITE_DEV_SERVER_URL) {
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', VITE_DEV_SERVER_URL)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#0c0c0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Show the window once the page is ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // No auto-hide on blur -- app shows in taskbar normally

  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow?.hide()
  })
}

function createTray() {
  // Destroy previous tray if it exists (prevents duplicate tray icons on hot-reload)
  if (tray) {
    tray.destroy()
    tray = null
  }

  // Load icon from file - works better on Windows
  const iconPath = path.join(app.getAppPath(), 'public', 'tray-icon.png')
  let trayIcon = nativeImage.createFromPath(iconPath)

  // Fallback to embedded if file not found
  if (trayIcon.isEmpty()) {
    const icon16Base64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVQ4T2NkoBAwUqifgWoGjBowasCoAQNvwFAIAwDkfQER39Vg/AAAAABJRU5ErkJggg=='
    trayIcon = nativeImage.createFromDataURL(`data:image/png;base64,${icon16Base64}`)
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Chugnus Command Center')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => showWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        mainWindow?.destroy()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    showWindow()
  })
}

function showWindow() {
  if (!mainWindow) return

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// Enforce single instance — quit if another is already running
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.center()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  // CSP: strict in production, relaxed in dev (Vite HMR needs inline scripts + eval)
  const csp = VITE_DEV_SERVER_URL
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https: wss: ws:"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https: wss:"
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  // Auto-grant microphone permission for voice commands
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['media', 'clipboard-read', 'notifications'].includes(permission))
  })

  initDatabase()
  createWindow()
  createTray()

  // Register all IPC handlers from modular files
  registerAllHandlers(mainWindow!)

  // Wire up agent launch function (IPC handler + module-level for retries)
  setAgentLaunchFn(launchInExternalTerminal)
  setLaunchFn(launchInExternalTerminal)

  // Run agent heartbeats every 60s
  setInterval(async () => {
    try {
      const agentRuns = runDueAgentHeartbeats(launchInExternalTerminal)
      if (agentRuns.length > 0) {
        mainWindow?.webContents.send('agents-updated')
      }
    } catch (e) { console.error('Agent heartbeat error:', e) }
  }, 60 * 1000)

  // Poll agent sessions every 30s — auto-complete, retry, and timeout detection
  setInterval(async () => {
    try {
      const changed = await pollAgentSessions()
      if (changed) mainWindow?.webContents.send('agents-updated')
    } catch (e) { console.error('Agent session poll error:', e) }
  }, 30 * 1000)

  // Scaffold domain-based memory folders
  scaffoldDomainFolders()

  // Start memory health monitor (check every 5 minutes, send updates on status change)
  startHealthMonitor(5 * 60 * 1000, (health) => {
    mainWindow?.webContents.send('memory-health-update', health)
  })

  // Background: pre-warm embedding model after 5s, then load existing vector index
  // NOTE: Full rebuild is triggered manually from the UI to avoid freezing on startup
  setTimeout(async () => {
    try {
      await initEmbeddingModel((progress) => {
        mainWindow?.webContents.send('embedding-progress', progress)
      })
      const embStatus = getEmbeddingStatus()
      if (embStatus.ready) {
        await loadVectorIndex()
      }
    } catch (err) {
      console.error('Background embedding/index init failed:', err)
    }
  }, 5000)
})

app.on('before-quit', () => {
  shutdownAllProcesses()
  if (tray) {
    tray.destroy()
    tray = null
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
