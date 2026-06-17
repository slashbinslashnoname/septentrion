import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleDot,
  File as FileIcon,
  GitPullRequest,
  GitPullRequestDraft,
  Hash,
  MessageSquare,
  Search,
  TextSearch
} from 'lucide-react'
import type { RefLookup, SearchContentResult, SearchFileResult } from '@shared/types'
import { GhAvatar } from '@/components/GhAvatar'
import { useApp } from '@/store'
import { cn } from '@/lib/utils'

type Mode = 'content' | 'file' | 'ref'

interface Row {
  mode: Mode
  path: string
  line?: number
  text?: string
}

export function SearchPalette(): React.JSX.Element | null {
  const { repo, searchOpen, setSearchOpen, searchSeed, openInBrowser } = useApp()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [refResult, setRefResult] = useState<RefLookup | null>(null)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const refMatch = query.match(/^#\s*(\d+)/)
  const refNumber = refMatch ? parseInt(refMatch[1], 10) : null
  const mode: Mode = refMatch ? 'ref' : query.startsWith('@') ? 'file' : 'content'
  const term = mode === 'file' ? query.slice(1).trim() : query.trim()
  const hasGithub = !!repo?.nameWithOwner

  // Reset + focus whenever the palette opens.
  useEffect(() => {
    if (searchOpen) {
      setQuery(searchSeed)
      setRows([])
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [searchOpen, searchSeed])

  // Debounced query → backend.
  useEffect(() => {
    if (!searchOpen || !repo) return
    if (mode === 'content' && !term) {
      setRows([])
      setRefResult(null)
      setTruncated(false)
      return
    }
    const handle = setTimeout(async () => {
      setLoading(true)
      if (mode === 'ref') {
        setRows([])
        const res = refNumber ? await window.api.ghLookup(repo.path, refNumber) : null
        setRefResult(res && res.ok ? (res.data ?? null) : null)
        setTruncated(false)
      } else if (mode === 'file') {
        setRefResult(null)
        const res = await window.api.searchFiles(repo.path, term)
        setRows(
          res.ok && res.data
            ? res.data.map((r: SearchFileResult) => ({ mode: 'file' as const, path: r.path }))
            : []
        )
        setTruncated(false)
      } else {
        setRefResult(null)
        const res = await window.api.searchContent(repo.path, term)
        setRows(
          res.ok && res.data
            ? res.data.results.map((r: SearchContentResult) => ({
                mode: 'content' as const,
                path: r.path,
                line: r.line,
                text: r.text
              }))
            : []
        )
        setTruncated(res.ok && res.data ? res.data.truncated : false)
      }
      setActive(0)
      setLoading(false)
    }, 160)
    return () => clearTimeout(handle)
  }, [query, term, mode, refNumber, searchOpen, repo])

  // Keep the active row in view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const { openRef } = useApp()

  const open = (row: Row): void => {
    if (!row) return
    openInBrowser(row.path, row.line)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setSearchOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (mode === 'ref' && refResult) openRef(refResult.type, refResult.number)
      else if (rows[active]) open(rows[active])
    }
  }

  const hint = useMemo(
    () =>
      mode === 'ref'
        ? 'Opening a pull request or issue by number'
        : mode === 'file'
          ? 'Finding files by name'
          : 'Search contents · @ files · # PR or issue',
    [mode]
  )

  if (!searchOpen) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 pt-[12vh]"
      onMouseDown={() => setSearchOpen(false)}
    >
      <div
        className="flex max-h-[70vh] w-[680px] max-w-[92vw] flex-col overflow-hidden rounded-xl border bg-popover shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3">
          {mode === 'ref' ? (
            <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : mode === 'file' ? (
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <TextSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search code…  (@ files · # PR/issue)"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            spellCheck={false}
          />
          {loading && <Search className="h-4 w-4 shrink-0 animate-pulse text-muted-foreground" />}
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1">
          {mode === 'ref' ? (
            !hasGithub ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No GitHub remote detected.
              </div>
            ) : loading ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Looking up #{refNumber}…
              </div>
            ) : refResult ? (
              <RefCard
                ref_={refResult}
                onOpen={() => openRef(refResult.type, refResult.number)}
              />
            ) : (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No pull request or issue #{refNumber}.
              </div>
            )
          ) : rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {term || mode === 'file'
                ? loading
                  ? 'Searching…'
                  : 'No results.'
                : 'Type to search across the repository.'}
            </div>
          ) : (
            rows.map((row, i) => (
              <button
                key={`${row.path}:${row.line ?? 0}:${i}`}
                data-idx={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => open(row)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                  i === active ? 'bg-secondary' : 'hover:bg-secondary/50'
                )}
              >
                {row.mode === 'file' ? (
                  <>
                    <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="mono truncate text-xs">
                      <Basename path={row.path} />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mono shrink-0 text-[10px] text-muted-foreground">
                      {row.path.split('/').pop()}:{row.line}
                    </span>
                    <span className="mono flex-1 truncate text-xs">
                      <Highlight text={row.text ?? ''} term={term} />
                    </span>
                  </>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>{hint}</span>
          <span className="flex items-center gap-2">
            {truncated && <span className="text-amber-500">showing first 500</span>}
            <kbd className="rounded bg-muted px-1">↑↓</kbd>
            <kbd className="rounded bg-muted px-1">↵</kbd>
            <kbd className="rounded bg-muted px-1">esc</kbd>
          </span>
        </div>
      </div>
    </div>
  )
}

function RefCard({ ref_, onOpen }: { ref_: RefLookup; onOpen: () => void }): React.JSX.Element {
  const isPull = ref_.type === 'pull'
  const state = ref_.state.toLowerCase()
  const stateColor =
    state === 'open'
      ? 'bg-emerald-500/15 text-emerald-500'
      : state === 'merged'
        ? 'bg-purple-500/15 text-purple-500'
        : 'bg-red-500/15 text-red-500'
  const Icon = isPull ? (ref_.isDraft ? GitPullRequestDraft : GitPullRequest) : CircleDot

  return (
    <button
      onClick={onOpen}
      className="mx-2 my-1 block w-[calc(100%-1rem)] rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40"
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', isPull ? 'text-emerald-500' : 'text-emerald-500')} />
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', stateColor)}>
          {ref_.isDraft ? 'draft' : state}
        </span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {isPull ? 'Pull Request' : 'Issue'}
        </span>
        <span className="mono ml-auto text-xs text-muted-foreground">#{ref_.number}</span>
      </div>

      <div className="mt-2 text-sm font-semibold leading-snug">{ref_.title}</div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <GhAvatar login={ref_.author} size={16} /> {ref_.author}
        </span>
        {isPull && ref_.headRefName && (
          <span className="mono">
            {ref_.headRefName} → {ref_.baseRefName}
          </span>
        )}
        {isPull && (
          <span className="mono">
            <span className="text-emerald-500">+{ref_.additions ?? 0}</span>{' '}
            <span className="text-red-500">−{ref_.deletions ?? 0}</span>
          </span>
        )}
        {ref_.comments > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> {ref_.comments}
          </span>
        )}
      </div>

      {ref_.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ref_.labels.map((l) => (
            <span
              key={l.name}
              className="rounded-full px-1.5 py-0 text-[10px] font-medium"
              style={{
                backgroundColor: `#${l.color}22`,
                color: `#${l.color}`,
                border: `1px solid #${l.color}55`
              }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      {ref_.body && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
          {ref_.body.slice(0, 400)}
        </p>
      )}

      <div className="mt-2 text-[11px] text-primary">Press ↵ to open</div>
    </button>
  )
}

function Basename({ path }: { path: string }): React.JSX.Element {
  const i = path.lastIndexOf('/')
  if (i < 0) return <span className="text-foreground">{path}</span>
  return (
    <>
      <span className="text-foreground">{path.slice(i + 1)}</span>
      <span className="text-muted-foreground"> — {path.slice(0, i)}</span>
    </>
  )
}

function Highlight({ text, term }: { text: string; term: string }): React.JSX.Element {
  if (!term) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx < 0) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-300/40 text-foreground">
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </span>
  )
}
