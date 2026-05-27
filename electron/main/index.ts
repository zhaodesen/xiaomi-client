import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'node:path'
import { writeFile, readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { Buffer } from 'node:buffer'
import { startSidecar, stopSidecar, getSidecar } from './sidecar'
import { readConfig, writeConfig, publicConfig, AppConfig } from './config'

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#0a0a0b',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Block window from navigating away; external links open in OS browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc() {
  ipcMain.handle('sidecar:info', () => {
    const s = getSidecar()
    if (!s) return null
    return { baseUrl: s.baseUrl, host: s.host, port: s.port }
  })

  ipcMain.handle('config:get', () => publicConfig())

  ipcMain.handle('config:set', async (_evt, patch: Partial<AppConfig>) => {
    const next = writeConfig(patch)
    // Restart sidecar so the new env propagates.
    await stopSidecar()
    const s = await startSidecar()
    // Forward the latest key as env before respawn — sidecar reads from
    // MIMO_API_KEY OR from the on-disk config; we keep both in sync.
    process.env.MIMO_API_KEY = next.apiKey
    process.env.MIMO_BASE_URL = next.baseUrl
    return { ok: true, baseUrl: s.baseUrl }
  })

  ipcMain.handle('dialog:openFile', async (_evt, filters: Electron.FileFilter[]) => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters
    })
    if (res.canceled || !res.filePaths[0]) return null
    return res.filePaths[0]
  })

  ipcMain.handle('dialog:openDir', async () => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return null
    return res.filePaths[0]
  })

  ipcMain.handle('app:getPath', (_evt, name: string) => {
    try {
      return app.getPath(name as never)
    } catch {
      return null
    }
  })

  ipcMain.handle('shell:openPath', async (_evt, p: string) => {
    return shell.openPath(p)
  })

  ipcMain.handle('shell:showItemInFolder', (_evt, p: string) => {
    shell.showItemInFolder(p)
  })

  ipcMain.handle('dialog:saveFile', async (_evt, defaultName: string, filters: Electron.FileFilter[]) => {
    if (!mainWindow) return null
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters
    })
    if (res.canceled || !res.filePath) return null
    return res.filePath
  })

  ipcMain.handle('fs:writeBase64', async (_evt, path: string, base64: string) => {
    const buf = Buffer.from(base64, 'base64')
    await writeFile(path, buf)
    return { ok: true, bytes: buf.byteLength }
  })

  // 读本地文件并返回 data URL，给渲染端做预览（替代 file:// 协议）。
  // limitMB 控制最大读取大小，避免大视频文件把内存撑爆。
  ipcMain.handle(
    'fs:readAsDataUrl',
    async (_evt, path: string, limitMB = 80) => {
      const info = await stat(path)
      if (info.size > limitMB * 1024 * 1024) {
        return { ok: false, reason: 'too-large', size: info.size }
      }
      const buf = await readFile(path)
      const ext = extname(path).toLowerCase()
      const mimeMap: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm',
        '.m4v': 'video/x-m4v',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg'
      }
      const mime = mimeMap[ext] ?? 'application/octet-stream'
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
      return { ok: true, dataUrl, size: info.size, mime }
    }
  )

  ipcMain.handle('updater:check', async () => {
    if (isDev) return { ok: false, reason: 'dev' }
    try {
      const r = await autoUpdater.checkForUpdates()
      return { ok: true, info: r?.updateInfo ?? null }
    } catch (err) {
      return { ok: false, reason: String(err) }
    }
  })

  ipcMain.handle('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall()
  })
}

function setupAutoUpdater() {
  if (isDev) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (channel: string, payload?: unknown) =>
    mainWindow?.webContents.send(channel, payload)

  autoUpdater.on('checking-for-update', () => send('updater:event', { type: 'checking' }))
  autoUpdater.on('update-available', (info) => send('updater:event', { type: 'available', info }))
  autoUpdater.on('update-not-available', () => send('updater:event', { type: 'none' }))
  autoUpdater.on('error', (err) => send('updater:event', { type: 'error', message: String(err) }))
  autoUpdater.on('download-progress', (p) => send('updater:event', { type: 'progress', percent: p.percent }))
  autoUpdater.on('update-downloaded', (info) => send('updater:event', { type: 'downloaded', info }))

  // Defer first check until after window is up.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => console.error('[updater]', e))
  }, 5_000)
}

app.whenReady().then(async () => {
  // Sync env from on-disk config so sidecar inherits it.
  const cfg = readConfig()
  if (cfg.apiKey) process.env.MIMO_API_KEY = cfg.apiKey
  if (cfg.baseUrl) process.env.MIMO_BASE_URL = cfg.baseUrl

  registerIpc()
  try {
    await startSidecar()
  } catch (err) {
    console.error('[main] sidecar boot failed', err)
    dialog.showErrorBox('Sidecar 启动失败', String(err))
  }
  await createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await stopSidecar()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async (event) => {
  if (!getSidecar()) return
  event.preventDefault()
  await stopSidecar()
  app.quit()
})
