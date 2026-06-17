import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Settings } from '@shared/types'

const DEFAULTS: Settings = { theme: 'system', recentRepos: [], seen: {} }

function file(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'settings.json')
}

export function readSettings(): Settings {
  try {
    const raw = readFileSync(file(), 'utf8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const next = { ...readSettings(), ...patch }
  writeFileSync(file(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function addRecentRepo(path: string): Settings {
  const cur = readSettings()
  const recentRepos = [path, ...cur.recentRepos.filter((p) => p !== path)].slice(0, 10)
  return writeSettings({ recentRepos })
}

/** Record that the user has seen one or more items at the given updatedAt stamps. */
export function markSeen(repoKey: string, entries: Record<string, string>): Settings {
  const cur = readSettings()
  const seen = { ...cur.seen }
  seen[repoKey] = { ...(seen[repoKey] ?? {}), ...entries }
  return writeSettings({ seen })
}
