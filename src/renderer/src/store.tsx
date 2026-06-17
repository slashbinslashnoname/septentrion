import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { IssueSummary, PullSummary, RepoInfo } from '@shared/types'
import { cacheSet } from '@/lib/cache'

export interface MentionSuggestion {
  /** text inserted into the textarea, e.g. "#123" or "@octocat" */
  value: string
  primary: string
  kind: 'ref' | 'user'
  refType?: 'issue' | 'pull'
  state?: string
  number?: number
}

export type Theme = 'light' | 'dark' | 'system'
export type Section =
  | 'changes'
  | 'history'
  | 'browser'
  | 'branches'
  | 'worktrees'
  | 'issues'
  | 'pulls'

export interface Toast {
  id: number
  title: string
  description?: string
  variant: 'default' | 'success' | 'error'
}

interface AppState {
  repo: RepoInfo | null
  setRepo: (r: RepoInfo | null) => void
  refreshRepo: () => Promise<void>
  section: Section
  setSection: (s: Section) => void
  theme: Theme
  setTheme: (t: Theme) => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
  /** monotonically increasing token; bump to force dependent views to reload */
  rev: number
  bump: () => void
  // search palette
  searchOpen: boolean
  setSearchOpen: (b: boolean) => void
  /** the query the palette opens with (e.g. "@" for file-finder mode) */
  searchSeed: string
  openSearch: (seed?: string) => void
  // a file (and optional line) to reveal in the Browser
  fileTarget: { path: string; line?: number; token: number } | null
  openInBrowser: (path: string, line?: number) => void
  clearFileTarget: () => void
  // a PR/issue number to open in the Pulls/Issues view
  refTarget: { type: 'pull' | 'issue'; number: number; token: number } | null
  openRef: (type: 'pull' | 'issue', number: number) => void
  // unread notifications for open issues / pull requests
  unread: { issues: number; pulls: number }
  /** bumps whenever the seen-map changes, so lists re-render their dots */
  seenRev: number
  isUnread: (type: 'issue' | 'pull', number: number, updatedAt: string) => boolean
  markRead: (type: 'issue' | 'pull', number: number, updatedAt: string) => void
  markAllRead: (type: 'issue' | 'pull') => void
  refreshUnread: () => void
  /** autocomplete suggestions for the comment composer (# refs, @ users) */
  suggestMentions: (trigger: '#' | '@', query: string) => MentionSuggestion[]
}

const Ctx = createContext<AppState | null>(null)

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
  root.classList.toggle('light', !dark)
}

export function AppProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [section, setSection] = useState<Section>('changes')
  const [theme, setThemeState] = useState<Theme>('system')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [rev, setRev] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchSeed, setSearchSeed] = useState('')
  const [fileTarget, setFileTarget] = useState<AppState['fileTarget']>(null)
  const [refTarget, setRefTarget] = useState<AppState['refTarget']>(null)
  const [unread, setUnread] = useState({ issues: 0, pulls: 0 })
  const [seenRev, setSeenRev] = useState(0)
  const idRef = useRef(1)
  const targetTokenRef = useRef(1)
  // Per-repo "last seen" map and the most recent open lists, kept in refs so
  // recomputing unread counts never needs a network round-trip.
  const seenRef = useRef<Record<string, string>>({})
  const openIssuesRef = useRef<IssueSummary[]>([])
  const openPullsRef = useRef<PullSummary[]>([])
  const prevUnreadIdsRef = useRef<Set<string>>(new Set())

  const repoKey = repo?.nameWithOwner ?? repo?.path ?? ''

  useEffect(() => {
    window.api.getSettings().then((res) => {
      if (res.ok && res.data) {
        setThemeState(res.data.theme)
        applyTheme(res.data.theme)
      }
    })
  }, [])

  useEffect(() => {
    applyTheme(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => {
      if (theme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = (t: Theme): void => {
    setThemeState(t)
    applyTheme(t)
    window.api.setSettings({ theme: t })
  }

  const toast = (t: Omit<Toast, 'id'>): void => {
    const id = idRef.current++
    setToasts((cur) => [...cur, { ...t, id }])
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 4200)
  }
  const dismiss = (id: number): void => setToasts((cur) => cur.filter((x) => x.id !== id))

  const bump = (): void => setRev((r) => r + 1)

  const openSearch = (seed = ''): void => {
    setSearchSeed(seed)
    setSearchOpen(true)
  }

  const openInBrowser = (path: string, line?: number): void => {
    setFileTarget({ path, line, token: targetTokenRef.current++ })
    setSection('browser')
    setSearchOpen(false)
  }
  const clearFileTarget = (): void => setFileTarget(null)

  const openRef = (type: 'pull' | 'issue', number: number): void => {
    setRefTarget({ type, number, token: targetTokenRef.current++ })
    setSection(type === 'pull' ? 'pulls' : 'issues')
    setSearchOpen(false)
  }

  // ---- unread tracking ----

  const itemKey = (type: 'issue' | 'pull', number: number): string => `${type}:${number}`

  const isUnread = useCallback(
    (type: 'issue' | 'pull', number: number, updatedAt: string): boolean => {
      const s = seenRef.current[itemKey(type, number)]
      return !s || s < updatedAt
    },
    []
  )

  const recomputeCounts = useCallback((): void => {
    const issues = openIssuesRef.current.filter((i) =>
      isUnread('issue', i.number, i.updatedAt)
    ).length
    const pulls = openPullsRef.current.filter((p) => isUnread('pull', p.number, p.updatedAt)).length
    setUnread({ issues, pulls })
  }, [isUnread])

  const refreshUnread = useCallback(async (): Promise<void> => {
    if (!repo?.nameWithOwner) {
      openIssuesRef.current = []
      openPullsRef.current = []
      setUnread({ issues: 0, pulls: 0 })
      return
    }
    const [iss, pr] = await Promise.all([
      window.api.issues(repo.path, 'open'),
      window.api.pulls(repo.path, 'open')
    ])
    if (iss.ok && iss.data) {
      openIssuesRef.current = iss.data
      cacheSet(`issues:${repo.path}:open`, iss.data)
    }
    if (pr.ok && pr.data) {
      openPullsRef.current = pr.data
      cacheSet(`pulls:${repo.path}:open`, pr.data)
    }

    // Detect items that just became unread to fire a native notification.
    const ids = new Set<string>()
    for (const i of openIssuesRef.current)
      if (isUnread('issue', i.number, i.updatedAt)) ids.add(itemKey('issue', i.number))
    for (const p of openPullsRef.current)
      if (isUnread('pull', p.number, p.updatedAt)) ids.add(itemKey('pull', p.number))

    const fresh = [...ids].filter((id) => !prevUnreadIdsRef.current.has(id))
    if (
      prevUnreadIdsRef.current.size > 0 &&
      fresh.length > 0 &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      const n = new Notification(`${repo.name}: ${fresh.length} new update(s)`, {
        body: 'New activity in open pull requests / issues.'
      })
      n.onclick = (): void => setSection(fresh[0].startsWith('pull') ? 'pulls' : 'issues')
    }
    prevUnreadIdsRef.current = ids
    recomputeCounts()
  }, [repo, isUnread, recomputeCounts])

  const markRead = useCallback(
    (type: 'issue' | 'pull', number: number, updatedAt: string): void => {
      if (!isUnread(type, number, updatedAt)) return
      seenRef.current[itemKey(type, number)] = updatedAt
      prevUnreadIdsRef.current.delete(itemKey(type, number))
      window.api.markSeen(repoKey, { [itemKey(type, number)]: updatedAt })
      recomputeCounts()
      setSeenRev((r) => r + 1)
    },
    [isUnread, repoKey, recomputeCounts]
  )

  const markAllRead = useCallback(
    (type: 'issue' | 'pull'): void => {
      const list = type === 'issue' ? openIssuesRef.current : openPullsRef.current
      const entries: Record<string, string> = {}
      for (const item of list) {
        const k = itemKey(type, item.number)
        seenRef.current[k] = item.updatedAt
        prevUnreadIdsRef.current.delete(k)
        entries[k] = item.updatedAt
      }
      if (Object.keys(entries).length) window.api.markSeen(repoKey, entries)
      recomputeCounts()
      setSeenRev((r) => r + 1)
    },
    [repoKey, recomputeCounts]
  )

  const suggestMentions = useCallback(
    (trigger: '#' | '@', query: string): MentionSuggestion[] => {
      const q = query.toLowerCase()
      if (trigger === '#') {
        const items: MentionSuggestion[] = [
          ...openPullsRef.current.map((p) => ({
            value: `#${p.number}`,
            primary: p.title,
            kind: 'ref' as const,
            refType: 'pull' as const,
            state: p.state,
            number: p.number
          })),
          ...openIssuesRef.current.map((i) => ({
            value: `#${i.number}`,
            primary: i.title,
            kind: 'ref' as const,
            refType: 'issue' as const,
            state: i.state,
            number: i.number
          }))
        ]
        const filtered = q
          ? items.filter(
              (it) => String(it.number).startsWith(q) || it.primary.toLowerCase().includes(q)
            )
          : items
        filtered.sort((a, b) => {
          const ap = String(a.number).startsWith(q) ? 0 : 1
          const bp = String(b.number).startsWith(q) ? 0 : 1
          return ap - bp || (a.number ?? 0) - (b.number ?? 0)
        })
        return filtered.slice(0, 8)
      }
      // '@' — participants gathered from open issues/PR authors.
      const logins = new Set<string>()
      for (const p of openPullsRef.current) if (p.author) logins.add(p.author)
      for (const i of openIssuesRef.current) if (i.author) logins.add(i.author)
      return [...logins]
        .filter((l) => !q || l.toLowerCase().startsWith(q))
        .sort()
        .slice(0, 8)
        .map((l) => ({ value: `@${l}`, primary: l, kind: 'user' as const }))
    },
    []
  )

  // Load the seen-map for the active repo, then compute unread + poll.
  useEffect(() => {
    if (!repo) return
    let timer: ReturnType<typeof setInterval> | undefined
    window.api.getSettings().then((res) => {
      seenRef.current = res.ok && res.data ? res.data.seen?.[repoKey] ?? {} : {}
      prevUnreadIdsRef.current = new Set()
      refreshUnread()
      timer = setInterval(refreshUnread, 120_000)
    })
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    return () => {
      if (timer) clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoKey])

  const refreshRepo = async (): Promise<void> => {
    if (!repo) return
    const res = await window.api.repoInfo(repo.path)
    if (res.ok && res.data) setRepo(res.data)
  }

  const value: AppState = {
    repo,
    setRepo,
    refreshRepo,
    section,
    setSection,
    theme,
    setTheme,
    toasts,
    toast,
    dismiss,
    rev,
    bump,
    searchOpen,
    setSearchOpen,
    searchSeed,
    openSearch,
    fileTarget,
    openInBrowser,
    clearFileTarget,
    refTarget,
    openRef,
    unread,
    seenRev,
    isUnread,
    markRead,
    markAllRead,
    refreshUnread,
    suggestMentions
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// Helper: unwrap an ApiResult, toasting + throwing on error.
export function useApi(): {
  call: <T>(p: Promise<{ ok: boolean; data?: T; error?: string }>, errTitle?: string) => Promise<T | undefined>
} {
  const { toast } = useApp()
  const call = useCallback(
    async <T,>(
      p: Promise<{ ok: boolean; data?: T; error?: string }>,
      errTitle = 'Something went wrong'
    ): Promise<T | undefined> => {
      const res = await p
      if (!res.ok) {
        toast({ title: errTitle, description: res.error, variant: 'error' })
        return undefined
      }
      // Void operations (checkout, commit, stage…) resolve with no data; return
      // a defined sentinel so callers can distinguish success from failure with
      // `result !== undefined`.
      return (res.data === undefined ? (true as unknown as T) : res.data)
    },
    [toast]
  )
  return { call }
}
