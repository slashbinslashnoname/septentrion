import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  File as FileIcon,
  FileCode,
  Folder,
  FolderOpen,
  Image,
  RefreshCw
} from 'lucide-react'
import type { DirEntry, FileBlob, FileBranchDiff } from '@shared/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { DiffView } from '@/components/DiffView'
import { useApi, useApp } from '@/store'
import { highlightCode } from '@/lib/highlight'
import { cn } from '@/lib/utils'

export function BrowserView(): React.JSX.Element {
  const { repo, rev, fileTarget } = useApp()
  const { call } = useApi()
  const path = repo!.path

  const [children, setChildren] = useState<Record<string, DirEntry[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [blob, setBlob] = useState<FileBlob | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [lineTarget, setLineTarget] = useState<number | undefined>(undefined)
  const [diff, setDiff] = useState<FileBranchDiff | null>(null)
  const [mode, setMode] = useState<'code' | 'diff'>('code')
  const prevPathRef = useRef<string | null>(null)
  const prevRevRef = useRef<number>(rev)
  const consumedTokenRef = useRef<number>(-1)
  const treeRef = useRef<HTMLDivElement>(null)

  const loadDir = useCallback(
    async (rel: string) => {
      const res = await call(window.api.browseDir(path, rel), 'Failed to read folder')
      if (res) setChildren((prev) => ({ ...prev, [rel]: res }))
    },
    [path, call]
  )

  // Full reset only when the repo path actually changes. Guarding with a ref
  // means StrictMode's double-invoke (and unrelated re-renders) can't wipe the
  // open file or the expanded tree.
  useEffect(() => {
    if (prevPathRef.current === path) return
    prevPathRef.current = path
    setChildren({})
    setExpanded(new Set())
    setSelected(null)
    setBlob(null)
    setLineTarget(undefined)
    loadDir('')
  }, [path, loadDir])

  // On external changes (commit, checkout, fetch…) refresh the loaded folders
  // in place, keeping the current expansion and selection.
  useEffect(() => {
    if (prevRevRef.current === rev) return
    prevRevRef.current = rev
    loadDir('')
    expanded.forEach((d) => loadDir(d))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev])

  const toggle = (rel: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(rel)) next.delete(rel)
      else {
        next.add(rel)
        if (!children[rel]) loadDir(rel)
      }
      return next
    })
  }

  const openFile = useCallback(
    async (rel: string, line?: number) => {
      setSelected(rel)
      setLineTarget(line)
      setLoadingFile(true)
      setBlob(null)
      const res = await call(window.api.browseFile(path, rel), 'Failed to read file')
      setLoadingFile(false)
      if (res) setBlob(res)
    },
    [path, call]
  )

  // Expand every ancestor folder of `rel` so the file is visible in the tree.
  const revealAncestors = useCallback(
    (rel: string) => {
      const parts = rel.split('/')
      const dirs: string[] = []
      let acc = ''
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i]
        dirs.push(acc)
      }
      setExpanded((prev) => {
        const next = new Set(prev)
        for (const d of dirs) {
          next.add(d)
          if (!children[d]) loadDir(d)
        }
        return next
      })
    },
    [children, loadDir]
  )

  // Respond to "open this file" requests coming from search / other views.
  // A consumed-token ref makes this idempotent (safe under StrictMode and
  // unrelated re-renders) without mutating shared state mid-render.
  useEffect(() => {
    if (!fileTarget || fileTarget.token === consumedTokenRef.current) return
    consumedTokenRef.current = fileTarget.token
    revealAncestors(fileTarget.path)
    openFile(fileTarget.path, fileTarget.line)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileTarget])

  // Keep the selected file scrolled into view in the tree once it's rendered.
  useEffect(() => {
    if (!selected) return
    const el = treeRef.current?.querySelector(`[data-treepath="${CSS.escape(selected)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected, children])

  // Load the branch diff for the selected file (committed + uncommitted vs base).
  useEffect(() => {
    setDiff(null)
    setMode('code')
    if (!selected) return
    window.api.fileDiff(path, selected).then((res) => {
      if (res.ok && res.data) setDiff(res.data)
    })
  }, [selected, path, rev])

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-0" autoSaveId="sept-browser">
      <ResizablePanel defaultSize={26} minSize={15} maxSize={50} className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <FolderOpen className="h-4 w-4 text-primary" />
          <span className="truncate text-sm font-medium">{repo!.name}</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => loadDir('')}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div ref={treeRef} className="py-1">
            <Tree
              rel=""
              depth={0}
              children={children}
              expanded={expanded}
              selected={selected}
              onToggle={toggle}
              onOpenFile={openFile}
            />
          </div>
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={74} className="min-w-0">
        <CodeView
          rel={selected}
          blob={blob}
          loading={loadingFile}
          targetLine={lineTarget}
          diff={diff}
          mode={mode}
          onMode={setMode}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function Tree({
  rel,
  depth,
  children,
  expanded,
  selected,
  onToggle,
  onOpenFile
}: {
  rel: string
  depth: number
  children: Record<string, DirEntry[]>
  expanded: Set<string>
  selected: string | null
  onToggle: (rel: string) => void
  onOpenFile: (rel: string) => void
}): React.JSX.Element | null {
  const entries = children[rel]
  if (!entries) return null
  return (
    <>
      {entries.map((e) => {
        const isOpen = expanded.has(e.path)
        const isSel = selected === e.path
        return (
          <div key={e.path}>
            <button
              data-treepath={e.path}
              onClick={() => (e.type === 'dir' ? onToggle(e.path) : onOpenFile(e.path))}
              className={cn(
                'flex w-full items-center gap-1 py-1 pr-2 text-left text-sm transition-colors hover:bg-secondary/50',
                isSel && 'bg-secondary'
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {e.type === 'dir' ? (
                <>
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                      isOpen && 'rotate-90'
                    )}
                  />
                  {isOpen ? (
                    <FolderOpen className="h-4 w-4 shrink-0 text-amber-500/80" />
                  ) : (
                    <Folder className="h-4 w-4 shrink-0 text-amber-500/80" />
                  )}
                </>
              ) : (
                <>
                  <span className="w-3.5 shrink-0" />
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
              <span className="mono truncate text-xs">{e.name}</span>
            </button>
            {e.type === 'dir' && isOpen && (
              <Tree
                rel={e.path}
                depth={depth + 1}
                children={children}
                expanded={expanded}
                selected={selected}
                onToggle={onToggle}
                onOpenFile={onOpenFile}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

function CodeView({
  rel,
  blob,
  loading,
  targetLine,
  diff,
  mode,
  onMode
}: {
  rel: string | null
  blob: FileBlob | null
  loading: boolean
  targetLine?: number
  diff: FileBranchDiff | null
  mode: 'code' | 'diff'
  onMode: (m: 'code' | 'diff') => void
}): React.JSX.Element {
  const lines = useMemo(
    () => (blob?.content ? blob.content.replace(/\n$/, '').split('\n') : []),
    [blob]
  )
  const changes = useMemo(() => {
    const files = diff?.files ?? []
    return {
      added: files.reduce((n, f) => n + f.added, 0),
      deleted: files.reduce((n, f) => n + f.deleted, 0),
      changed: files.length > 0
    }
  }, [diff])
  const html = useMemo(
    () => (blob?.kind === 'text' && blob.content ? highlightCode(blob.content, rel ?? '') : ''),
    [blob, rel]
  )

  const targetRef = useRef<HTMLDivElement>(null)
  const [band, setBand] = useState<{ top: number; height: number } | null>(null)

  // When a specific line is requested (e.g. from search), scroll to it and
  // paint a transient highlight band. Geometry comes from the gutter row ref.
  useEffect(() => {
    if (!targetLine || blob?.kind !== 'text') {
      setBand(null)
      return
    }
    const id = requestAnimationFrame(() => {
      const el = targetRef.current
      if (!el) return
      setBand({ top: el.offsetTop, height: el.offsetHeight })
      el.scrollIntoView({ block: 'center' })
    })
    return () => cancelAnimationFrame(id)
  }, [targetLine, blob, html])

  if (!rel) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <FileCode className="h-8 w-8 opacity-40" />
        <span className="text-sm">Select a file to view its contents.</span>
      </div>
    )
  }

  const isImage = blob?.kind === 'image'
  const canDiff = !isImage && blob?.kind === 'text'

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-card/40 px-3 py-2">
        {isImage ? (
          <Image className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileCode className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="mono truncate text-xs">{rel}</span>

        {/* Code / Diff toggle — emphasised when the file changed in this branch */}
        {canDiff && (
          <div className="ml-auto flex items-center gap-2">
            {changes.changed && (
              <span className="mono text-[11px]">
                <span className="text-emerald-500">+{changes.added}</span>{' '}
                <span className="text-red-500">−{changes.deleted}</span>
              </span>
            )}
            <div className="flex overflow-hidden rounded-md border text-xs">
              <button
                onClick={() => onMode('code')}
                className={cn(
                  'px-2 py-0.5 transition-colors',
                  mode === 'code' ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-secondary/50'
                )}
              >
                Code
              </button>
              <button
                onClick={() => onMode('diff')}
                disabled={!changes.changed}
                className={cn(
                  'border-l px-2 py-0.5 transition-colors',
                  mode === 'diff' ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-secondary/50',
                  changes.changed && mode !== 'diff' && 'text-amber-500',
                  !changes.changed && 'cursor-not-allowed opacity-40'
                )}
                title={changes.changed ? `Diff vs ${diff?.base}` : 'No changes in this branch'}
              >
                Diff
              </button>
            </div>
          </div>
        )}
        {blob && !canDiff && (
          <span className="ml-auto text-xs text-muted-foreground">{formatBytes(blob.size)}</span>
        )}
      </div>

      {mode === 'diff' && canDiff ? (
        <ScrollArea className="flex-1">
          <div className="px-3 pt-2 text-xs text-muted-foreground">
            Comparing against <span className="mono text-foreground">{diff?.base}</span>
          </div>
          <DiffView files={diff?.files ?? []} />
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : isImage ? (
          blob?.dataUrl ? (
            <div className="checkerboard flex min-h-full items-center justify-center p-6">
              <img
                src={blob.dataUrl}
                alt={rel}
                className="max-w-full rounded border border-border/50 shadow-sm"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              Image is too large to display ({formatBytes(blob?.size ?? 0)}).
            </div>
          )
        ) : blob?.kind === 'binary' ? (
          <div className="p-6 text-sm text-muted-foreground">Binary file — cannot display.</div>
        ) : blob?.truncated ? (
          <div className="p-6 text-sm text-muted-foreground">
            File is too large to display ({formatBytes(blob.size)}).
          </div>
        ) : (
          <div className="mono relative flex text-xs leading-[1.6]">
            {band && (
              <div
                className="pointer-events-none absolute inset-x-0 border-y border-primary/40 bg-primary/10"
                style={{ top: band.top, height: band.height }}
              />
            )}
            <div className="relative z-10 select-none border-r border-border/50 px-2 py-2 text-right text-muted-foreground/50">
              {lines.map((_, i) => (
                <div
                  key={i}
                  ref={i + 1 === targetLine ? targetRef : undefined}
                  className={cn(i + 1 === targetLine && 'font-bold text-primary')}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <pre className="hljs relative z-10 flex-1 overflow-x-auto whitespace-pre bg-transparent px-3 py-2">
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </div>
        )}
        </ScrollArea>
      )}
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
