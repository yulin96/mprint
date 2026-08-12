import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, MPrintAPI, PrintRequest } from '../shared/print-types'

// Custom APIs for renderer
const api: MPrintAPI = {
  getStatus: () => ipcRenderer.invoke('mprint:status'),
  getSettings: () => ipcRenderer.invoke('mprint:settings:get'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('mprint:settings:save', settings),
  getPrinters: () => ipcRenderer.invoke('mprint:printers'),
  print: (request: PrintRequest) => ipcRenderer.invoke('mprint:print', request),
  preview: (request: PrintRequest) => ipcRenderer.invoke('mprint:preview', request),
  openEditor: () => ipcRenderer.invoke('mprint:editor:open')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  const globalWindow = window as typeof window & { api: MPrintAPI }
  globalWindow.api = api
}
