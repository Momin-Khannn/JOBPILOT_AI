import { app, BrowserWindow, Menu, dialog, shell } from 'electron'
import { spawn } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.JOBPILOT_DESKTOP_PORT || 51234)
const APP_URL = `http://127.0.0.1:${PORT}`
const PUBLIC_APP_URL = (process.env.JOBPILOT_PUBLIC_URL || 'https://jobpilot-ai.up.railway.app').replace(/\/$/, '')
const WINDOW_ICON = path.join(__dirname, 'assets', 'jobpilot.ico')

let mainWindow = null
let backendProcess = null

function getAppRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'jobpilot')
  }
  return path.resolve(__dirname, '..')
}

function getSecretPath() {
  return path.join(app.getPath('userData'), 'encryption-secret.txt')
}

function getEncryptionSecret() {
  const secretPath = getSecretPath()
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim()
  }
  const secret = crypto.randomBytes(32).toString('hex')
  fs.mkdirSync(path.dirname(secretPath), { recursive: true })
  fs.writeFileSync(secretPath, secret)
  return secret
}

function backendEntry(root) {
  return path.join(root, 'backend', 'src', 'index.js')
}

function distReady(root) {
  return fs.existsSync(path.join(root, 'frontend', 'dist', 'index.html'))
}

function waitForHealth(timeoutMs = 90000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`${APP_URL}/api/health`, res => {
        res.resume()
        if (res.statusCode === 200) resolve()
        else retry()
      })
      req.on('error', retry)
      function retry() {
        if (Date.now() - started > timeoutMs) {
          reject(new Error('JobPilot server did not start in time'))
          return
        }
        setTimeout(tick, 400)
      }
    }
    tick()
  })
}

function startBackend(root) {
  const entry = backendEntry(root)
  if (!fs.existsSync(entry)) {
    throw new Error(`Backend not found at ${entry}`)
  }

  const secret = getEncryptionSecret()
  const nodeBinary = app.isPackaged ? process.execPath : (process.env.npm_node_execpath || 'node')
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    TRUST_PROXY: 'true',
    ENCRYPTION_SECRET: secret,
    FRONTEND_URL: APP_URL,
    ENABLE_OWNER_PORTAL: 'false',
    GOOGLE_REDIRECT_URI: `${APP_URL}/api/gmail/callback`,
    ENABLE_REAL_SEND: 'false',
  }
  if (app.isPackaged) env.ELECTRON_RUN_AS_NODE = '1'
  if (app.isPackaged) {
    env.JOBPILOT_DATA_DIR = path.join(app.getPath('userData'), 'data')
  }

  backendProcess = spawn(nodeBinary, [entry], {
    cwd: root,
    env,
    stdio: app.isPackaged ? 'ignore' : 'inherit',
  })

  backendProcess.on('error', err => {
    dialog.showErrorBox('JobPilot backend error', err.message)
  })

  backendProcess.on('exit', code => {
    if (code && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox('JobPilot stopped', `The server exited with code ${code}`)
    }
  })
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill()
    backendProcess = null
  }
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'reload' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'toggleDevTools' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open JobPilot Web',
          click: () => shell.openExternal(PUBLIC_APP_URL),
        },
        {
          label: 'Support',
          click: () => shell.openExternal(`${PUBLIC_APP_URL}/support`),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function createWindow() {
  const root = getAppRoot()

  if (!distReady(root)) {
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Build required',
      message: 'Production web assets are missing.',
      detail: 'From the jobpilot-ai folder run:\n\n  npm install\n  npm run build\n  npm run desktop',
      buttons: ['Quit', 'Continue anyway'],
      defaultId: 0,
      cancelId: 0,
    })
    if (response === 0) {
      app.quit()
      return
    }
  }

  try {
    startBackend(root)
    await waitForHealth()
  } catch (err) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Could not start JobPilot',
      message: err.message,
      detail: 'Try: npm run fix:sqlite\nThen: npm run build && npm run desktop',
    })
    app.quit()
    return
  }

  mainWindow = new BrowserWindow({
    show: process.env.JOBPILOT_SMOKE_TEST !== 'true',
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'JobPilot AI',
    icon: WINDOW_ICON,
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(APP_URL)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) && !url.startsWith(APP_URL)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.setAppUserModelId('ai.jobpilot.desktop')

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    buildMenu()
    createWindow()
  })

  app.on('window-all-closed', () => {
    stopBackend()
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    stopBackend()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}
