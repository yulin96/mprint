import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import icon from '../../resources/icon.png?asset'
import type { AppSettings } from '../shared/print-types'
import { LocalPrintServer } from './local-server'
import { readSettings, saveSettings } from './settings-store'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let printServer: LocalPrintServer | null = null
let settings: AppSettings
let isQuitting = false

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'mprint',
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#fafafa',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', (event) => {
    if (!isQuitting && settings.closeToTray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  if (tray) return
  tray = new Tray(nativeImage.createFromPath(icon))
  tray.setToolTip('mprint 本地打印服务')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开 mprint', click: showMainWindow },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', showMainWindow)
}

function syncAutoLaunch(): void {
  if (!app.isPackaged || (process.platform !== 'win32' && process.platform !== 'darwin')) return
  app.setLoginItemSettings({ openAtLogin: settings.autoLaunch })
}

function registerIpcHandlers(): void {
  ipcMain.handle('mprint:status', () => printServer?.getStatus())
  ipcMain.handle('mprint:settings:get', () => settings)
  ipcMain.handle('mprint:settings:save', async (_event, value: unknown) => {
    settings = saveSettings(value)
    syncAutoLaunch()
    return printServer?.restart(settings)
  })
  ipcMain.handle('mprint:printers', () => printServer?.getPrinters())
  ipcMain.handle('mprint:print', (_event, value: unknown) => printServer?.print(value))
  ipcMain.handle('mprint:preview', (_event, value: unknown) => printServer?.preview(value))
  ipcMain.handle('mprint:editor:open', async () => {
    const status = printServer?.getStatus()
    if (!status?.running) throw new Error(status?.lastError || '本地打印服务尚未启动。')
    await shell.openExternal(status.editorUrl)
  })
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('ink.yul.mprint')
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

    settings = readSettings()
    createWindow()
    createTray()
    syncAutoLaunch()

    printServer = new LocalPrintServer(settings, () => mainWindow?.webContents ?? null)
    registerIpcHandlers()
    await printServer.start()

    app.on('activate', showMainWindow)
  })

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('window-all-closed', () => {
    if (!settings?.closeToTray) app.quit()
  })
}
