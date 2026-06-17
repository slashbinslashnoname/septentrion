import { app, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

export type UpdateState =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'none' }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

const SIX_HOURS = 6 * 60 * 60 * 1000

export function initUpdater(getWindow: () => BrowserWindow | null): void {
  // electron-updater only works in a packaged app (needs app-update.yml).
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (payload: UpdateState): void => {
    getWindow()?.webContents.send('update:status', payload)
  }

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (i) => send({ state: 'available', version: i.version }))
  autoUpdater.on('update-not-available', () => send({ state: 'none' }))
  autoUpdater.on('error', (err) => send({ state: 'error', message: err?.message ?? String(err) }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (i) => send({ state: 'ready', version: i.version }))

  void autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => void autoUpdater.checkForUpdates().catch(() => {}), SIX_HOURS)
}

export function checkForUpdates(): void {
  if (app.isPackaged) void autoUpdater.checkForUpdates().catch(() => {})
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
