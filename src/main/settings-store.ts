import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppSettings } from '../shared/print-types'

const defaultSettings: AppSettings = {
  port: 17653,
  autoLaunch: false,
  closeToTray: true
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function normalizeSettings(value: unknown): AppSettings {
  const settings = typeof value === 'object' && value !== null ? value : {}
  const record = settings as Record<string, unknown>
  const port = Number(record.port)

  return {
    port: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : defaultSettings.port,
    autoLaunch: record.autoLaunch === true,
    closeToTray: record.closeToTray !== false
  }
}

export function readSettings(): AppSettings {
  try {
    return normalizeSettings(JSON.parse(readFileSync(getSettingsPath(), 'utf8')))
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(value: unknown): AppSettings {
  const settings = normalizeSettings(value)
  writeFileSync(getSettingsPath(), `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  return settings
}
