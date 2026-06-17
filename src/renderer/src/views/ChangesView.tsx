import { useCallback, useEffect, useState } from 'react'
import { Minus, Plus, RotateCcw, Check } from 'lucide-react'
import type { DiffFile, FileStatus, StatusResult } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { DiffView } from '@/components/DiffView'
import { useApi, useApp } from '@/store'
import { cn } from '@/lib/utils'

const labelColor: Record<string, string> = {
  modified: 'text-amber-500',
  added: 'text-emerald-500',
  deleted: 'text-red-500',
  renamed: 'text-blue-500',
  untracked: 'text-emerald-500',
  conflicted: 'text-red-500'
}

function badge(label: string): string {
  return (
    {
      modified: 'M',
      added: 'A',
      deleted: 'D',
      renamed: 'R',
      copied: 'C',
      untracked: 'U',
      conflicted: '!',
      typechange: 'T'
    }[label] ?? '•'
  )
}

export function ChangesView(): React.JSX.Element {
  const { repo, refreshRepo, bump, toast } = useApp()
  const { call } = useApi()
  const [status, setStatus] = useState<StatusResult | null>(null)
  const [selected, setSelected] = useState<FileStatus | null>(null)
  const [diff, setDiff] = useState<DiffFile[]>([])
  const [message, setMessage] = useState('')
  const [committing, setCommitting] = useState(false)

  const path = repo!.path

  const load = useCallback(async () => {
    const res = await call(window.api.status(path), 'Failed to load status')
    if (res) {
      setStatus(res)
      setSelected((prev) => {
        const match = prev ? res.files.find((f) => f.path === prev.path) : undefined
        return match ?? res.files[0] ?? null
      })
    }
  }, [path, call])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selected) {
      setDiff([])
      return
    }
    const opts = selected.untracked
      ? { path: selected.path, untracked: true }
      : { path: selected.path, staged: selected.staged && !selected.unstaged }
    window.api.diff(path, opts).then((res) => setDiff(res.ok && res.data ? res.data : []))
  }, [selected, path, status])

  const staged = status?.files.filter((f) => f.staged) ?? []
  const unstaged = status?.files.filter((f) => f.unstaged || f.untracked) ?? []

  const act = async (fn: Promise<{ ok: boolean; error?: string }>, err: string): Promise<void> => {
    const ok = await call(fn, err)
    if (ok !== undefined) {
      await load()
      await refreshRepo()
    }
  }

  const stageAll = (): Promise<void> =>
    act(window.api.stage(path, unstaged.map((f) => f.path)), 'Failed to stage')
  const unstageAll = (): Promise<void> =>
    act(window.api.unstage(path, staged.map((f) => f.path)), 'Failed to unstage')

  const commit = async (): Promise<void> => {
    if (!message.trim() || staged.length === 0) return
    setCommitting(true)
    const ok = await call(window.api.commit(path, message.trim()), 'Commit failed')
    setCommitting(false)
    if (ok !== undefined) {
      toast({ title: 'Committed', description: `${staged.length} file(s)`, variant: 'success' })
      setMessage('')
      await load()
      await refreshRepo()
      bump()
    }
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-0" autoSaveId="sept-changes">
      {/* file lists + commit box */}
      <ResizablePanel defaultSize={30} minSize={20} maxSize={50} className="flex min-w-0 flex-col border-r">
        <ScrollArea className="flex-1">
          <FileGroup
            title="Staged"
            count={staged.length}
            action={
              staged.length > 0 ? (
                <Button variant="ghost" size="xs" onClick={unstageAll} className="gap-1">
                  <Minus className="h-3 w-3" /> Unstage all
                </Button>
              ) : null
            }
            files={staged}
            selected={selected}
            onSelect={setSelected}
            onToggle={(f) => act(window.api.unstage(path, [f.path]), 'Failed to unstage')}
            onDiscard={(f) => act(window.api.discard(path, [f.path]), 'Failed to discard')}
            staged
          />
          <FileGroup
            title="Changes"
            count={unstaged.length}
            action={
              unstaged.length > 0 ? (
                <Button variant="ghost" size="xs" onClick={stageAll} className="gap-1">
                  <Plus className="h-3 w-3" /> Stage all
                </Button>
              ) : null
            }
            files={unstaged}
            selected={selected}
            onSelect={setSelected}
            onToggle={(f) => act(window.api.stage(path, [f.path]), 'Failed to stage')}
            onDiscard={(f) => act(window.api.discard(path, [f.path]), 'Failed to discard')}
          />
          {status?.clean && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Working tree clean — nothing to commit.
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-3">
          <Textarea
            placeholder="Commit message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') commit()
            }}
            className="mb-2 h-20 resize-none text-sm"
          />
          <Button
            className="w-full gap-2"
            disabled={!message.trim() || staged.length === 0 || committing}
            onClick={commit}
            variant="success"
          >
            <Check className="h-4 w-4" />
            Commit {staged.length > 0 ? `${staged.length} file(s)` : ''}
            <span className="ml-auto text-xs opacity-70">⌘↵</span>
          </Button>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* diff */}
      <ResizablePanel defaultSize={70} className="min-w-0 bg-background">
        {selected ? (
          <ScrollArea className="h-full">
            <DiffView files={diff} />
          </ScrollArea>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a file to view its diff.
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function FileGroup({
  title,
  count,
  action,
  files,
  selected,
  onSelect,
  onToggle,
  onDiscard,
  staged
}: {
  title: string
  count: number
  action: React.ReactNode
  files: FileStatus[]
  selected: FileStatus | null
  onSelect: (f: FileStatus) => void
  onToggle: (f: FileStatus) => void
  onDiscard: (f: FileStatus) => void
  staged?: boolean
}): React.JSX.Element | null {
  if (count === 0) return null
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between bg-card/95 px-3 py-1.5 backdrop-blur">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title} <span className="ml-1 opacity-60">{count}</span>
        </span>
        {action}
      </div>
      {files.map((f) => {
        const isSel = selected?.path === f.path
        return (
          <div
            key={f.path}
            onClick={() => onSelect(f)}
            className={cn(
              'group flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm',
              isSel ? 'bg-secondary' : 'hover:bg-secondary/40'
            )}
          >
            <span className={cn('mono w-3 shrink-0 text-center text-xs font-bold', labelColor[f.label])}>
              {badge(f.label)}
            </span>
            <span className="mono truncate text-xs" title={f.path}>
              {f.path}
            </span>
            <div className="ml-auto flex shrink-0 items-center opacity-0 group-hover:opacity-100">
              {!staged && (
                <button
                  title="Discard changes"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDiscard(f)
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                title={staged ? 'Unstage' : 'Stage'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(f)
                }}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {staged ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
