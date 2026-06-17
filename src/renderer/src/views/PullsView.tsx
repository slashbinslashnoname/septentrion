import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCheck, GitPullRequest, GitPullRequestDraft, RefreshCw } from 'lucide-react'
import type { DiffFile, IssueDetail, PullDetail, PullSummary } from '@shared/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { DiffView } from '@/components/DiffView'
import { GhAvatar } from '@/components/GhAvatar'
import { Thread } from '@/views/IssuesView'
import { useApi, useApp } from '@/store'
import { cacheGet, cacheInvalidate, cacheSet } from '@/lib/cache'
import { cn, timeAgo } from '@/lib/utils'

export function PullsView(): React.JSX.Element {
  const { repo, toast, refTarget, isUnread, markRead, markAllRead, unread, refreshUnread } = useApp()
  const { call } = useApi()
  const [state, setState] = useState('open')
  const [pulls, setPulls] = useState<PullSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<PullDetail | null>(null)
  const [diff, setDiff] = useState<DiffFile[]>([])
  const [tab, setTab] = useState<'conversation' | 'diff'>('conversation')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const path = repo!.path
  // A "sticky" selection forced from outside (e.g. opening #2572 from search);
  // it survives list reloads even when the PR isn't in the current page.
  const stickyRef = useRef<number | null>(null)
  const consumedRefToken = useRef(-1)

  // Resolve the next selection, honouring an externally forced (sticky) target.
  const pickSelected = useCallback(
    (list: PullSummary[], prev: number | null): number | null => {
      if (stickyRef.current != null) return stickyRef.current
      return prev && list.some((p) => p.number === prev) ? prev : list[0]?.number ?? null
    },
    []
  )

  const load = useCallback(
    async (force = false) => {
      const key = `pulls:${path}:${state}`
      if (force) cacheInvalidate(`pulls:${path}:`)
      const cached = force ? undefined : cacheGet<PullSummary[]>(key)
      if (cached) {
        setPulls(cached)
        setSelected((prev) => pickSelected(cached, prev))
        return
      }
      setLoading(true)
      const res = await call(window.api.pulls(path, state), 'Failed to load pull requests')
      setLoading(false)
      if (res) {
        cacheSet(key, res)
        setPulls(res)
        setSelected((prev) => pickSelected(res, prev))
      }
    },
    [path, state, call, pickSelected]
  )

  useEffect(() => {
    load()
  }, [load])

  // Open a specific PR requested from the search palette.
  useEffect(() => {
    if (!refTarget || refTarget.type !== 'pull' || refTarget.token === consumedRefToken.current) {
      return
    }
    consumedRefToken.current = refTarget.token
    stickyRef.current = refTarget.number
    setSelected(refTarget.number)
    setState('all') // widen the list so the PR appears (no-op if already 'all')
  }, [refTarget])

  useEffect(() => {
    if (selected == null) {
      setDetail(null)
      setDiff([])
      return
    }
    const dKey = `pull:${path}:${selected}`
    const diffKey = `pulldiff:${path}:${selected}`
    const cachedDetail = cacheGet<PullDetail>(dKey)
    const cachedDiff = cacheGet<DiffFile[]>(diffKey)
    setDetail(cachedDetail ?? null)
    setDiff(cachedDiff ?? [])
    if (!cachedDetail) {
      window.api.pullDetail(path, selected).then((res) => {
        if (res.ok && res.data) {
          cacheSet(dKey, res.data)
          setDetail(res.data)
        }
      })
    }
    if (!cachedDiff) {
      window.api.pullDiff(path, selected).then((res) => {
        if (res.ok && res.data) {
          cacheSet(diffKey, res.data)
          setDiff(res.data)
        }
      })
    }
  }, [selected, path])

  // Mark a PR read once it's open in the detail pane.
  useEffect(() => {
    if (detail) markRead('pull', detail.number, detail.updatedAt)
  }, [detail, markRead])

  const submit = async (): Promise<void> => {
    if (!comment.trim() || selected == null) return
    setSending(true)
    const ok = await call(window.api.pullComment(path, selected, comment.trim()), 'Failed to comment')
    setSending(false)
    if (ok !== undefined) {
      toast({ title: 'Comment posted', variant: 'success' })
      setComment('')
      const res = await window.api.pullDetail(path, selected)
      if (res.ok && res.data) {
        cacheSet(`pull:${path}:${selected}`, res.data)
        cacheInvalidate(`pulls:${path}:`)
        setDetail(res.data)
      }
    }
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-0" autoSaveId="sept-pulls">
      <ResizablePanel defaultSize={34} minSize={22} maxSize={55} className="flex min-w-0 flex-col border-r">
        <div className="flex items-center gap-2 border-b p-2">
          <Tabs value={state} onValueChange={setState}>
            <TabsList className="h-8">
              <TabsTrigger value="open" className="text-xs">Open</TabsTrigger>
              <TabsTrigger value="merged" className="text-xs">Merged</TabsTrigger>
              <TabsTrigger value="closed" className="text-xs">Closed</TabsTrigger>
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1" />
          {unread.pulls > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="gap-1 text-muted-foreground"
              onClick={() => markAllRead('pull')}
              title="Mark all pull requests as read"
            >
              <CheckCheck className="h-3.5 w-3.5" /> {unread.pulls}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              load(true)
              refreshUnread()
            }}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {pulls.length === 0 && !loading && (
            <div className="p-6 text-center text-sm text-muted-foreground">No pull requests.</div>
          )}
          {pulls.map((p) => {
            const unreadItem = isUnread('pull', p.number, p.updatedAt)
            return (
            <div
              key={p.number}
              onClick={() => {
                stickyRef.current = null
                setSelected(p.number)
              }}
              className={cn(
                'cursor-pointer border-b border-border/40 px-3 py-2.5',
                selected === p.number ? 'bg-secondary' : 'hover:bg-secondary/40'
              )}
            >
              <div className="flex items-start gap-2">
                {p.isDraft ? (
                  <GitPullRequestDraft className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <GitPullRequest
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      p.state.toLowerCase() === 'open'
                        ? 'text-emerald-500'
                        : p.state.toLowerCase() === 'merged'
                          ? 'text-purple-500'
                          : 'text-red-500'
                    )}
                  />
                )}
                <span className={cn('text-sm leading-snug', unreadItem ? 'font-semibold' : 'font-medium')}>
                  {p.title}
                </span>
                {unreadItem && (
                  <span className="ml-auto mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" title="Unread" />
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-xs text-muted-foreground">
                <span className="mono">#{p.number}</span>
                <span className="flex items-center gap-1">
                  <GhAvatar login={p.author} size={14} /> {p.author}
                </span>
                <span>· {timeAgo(p.updatedAt)}</span>
                <span className="mono text-emerald-500">+{p.additions}</span>
                <span className="mono text-red-500">−{p.deletions}</span>
              </div>
              <div className="mono mt-1 truncate pl-6 text-[10px] text-muted-foreground/70">
                {p.headRefName} → {p.baseRefName}
              </div>
            </div>
            )
          })}
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={66} className="flex min-w-0 flex-col">
        {detail ? (
          <>
            <div className="flex items-center gap-2 border-b px-3 py-1.5">
              <Tabs value={tab} onValueChange={(v) => setTab(v as 'conversation' | 'diff')}>
                <TabsList className="h-8">
                  <TabsTrigger value="conversation" className="text-xs">
                    Conversation
                  </TabsTrigger>
                  <TabsTrigger value="diff" className="text-xs">
                    Diff ({detail.changedFiles})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {tab === 'conversation' ? (
              <Thread
                kind="pull"
                detail={detail as unknown as IssueDetail}
                comment={comment}
                setComment={setComment}
                onSubmit={submit}
                sending={sending}
                extraHeader={
                  <div className="mono mt-1 text-xs text-muted-foreground">
                    {detail.headRefName} → {detail.baseRefName} ·{' '}
                    <span className="text-emerald-500">+{detail.additions}</span>{' '}
                    <span className="text-red-500">−{detail.deletions}</span>
                  </div>
                }
              />
            ) : (
              <ScrollArea className="flex-1">
                <DiffView files={diff} />
              </ScrollArea>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {selected != null ? 'Loading…' : 'Select a pull request.'}
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
