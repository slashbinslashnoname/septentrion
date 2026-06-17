import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCheck, CircleDot, ExternalLink, MessageSquare, RefreshCw, Send } from 'lucide-react'
import type { IssueDetail, IssueSummary } from '@shared/types'
import { Button } from '@/components/ui/button'
import { MentionTextarea } from '@/components/MentionTextarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GhAvatar } from '@/components/GhAvatar'
import { Markdown } from '@/components/Markdown'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { useApi, useApp } from '@/store'
import { cacheGet, cacheInvalidate, cacheSet } from '@/lib/cache'
import { cn, timeAgo } from '@/lib/utils'

export function IssuesView(): React.JSX.Element {
  const { repo, toast, refTarget, isUnread, markRead, markAllRead, unread, refreshUnread } = useApp()
  const { call } = useApi()
  const [state, setState] = useState('open')
  const [issues, setIssues] = useState<IssueSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<IssueDetail | null>(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const path = repo!.path
  const stickyRef = useRef<number | null>(null)
  const consumedRefToken = useRef(-1)

  const pickSelected = useCallback(
    (list: IssueSummary[], prev: number | null): number | null => {
      if (stickyRef.current != null) return stickyRef.current
      return prev && list.some((i) => i.number === prev) ? prev : list[0]?.number ?? null
    },
    []
  )

  const load = useCallback(
    async (force = false) => {
      const key = `issues:${path}:${state}`
      if (force) cacheInvalidate(`issues:${path}:`)
      const cached = force ? undefined : cacheGet<IssueSummary[]>(key)
      if (cached) {
        setIssues(cached)
        setSelected((prev) => pickSelected(cached, prev))
        return
      }
      setLoading(true)
      const res = await call(window.api.issues(path, state), 'Failed to load issues')
      setLoading(false)
      if (res) {
        cacheSet(key, res)
        setIssues(res)
        setSelected((prev) => pickSelected(res, prev))
      }
    },
    [path, state, call, pickSelected]
  )

  useEffect(() => {
    load()
  }, [load])

  // Open a specific issue requested from the search palette.
  useEffect(() => {
    if (!refTarget || refTarget.type !== 'issue' || refTarget.token === consumedRefToken.current) {
      return
    }
    consumedRefToken.current = refTarget.token
    stickyRef.current = refTarget.number
    setSelected(refTarget.number)
    setState('all')
  }, [refTarget])

  useEffect(() => {
    if (selected == null) {
      setDetail(null)
      return
    }
    const key = `issue:${path}:${selected}`
    const cached = cacheGet<IssueDetail>(key)
    if (cached) {
      setDetail(cached)
      return
    }
    setDetail(null)
    window.api.issue(path, selected).then((res) => {
      if (res.ok && res.data) {
        cacheSet(key, res.data)
        setDetail(res.data)
      }
    })
  }, [selected, path])

  // Mark an issue read once it's open in the detail pane.
  useEffect(() => {
    if (detail) markRead('issue', detail.number, detail.updatedAt)
  }, [detail, markRead])

  const submit = async (): Promise<void> => {
    if (!comment.trim() || selected == null) return
    setSending(true)
    const ok = await call(window.api.issueComment(path, selected, comment.trim()), 'Failed to comment')
    setSending(false)
    if (ok !== undefined) {
      toast({ title: 'Comment posted', variant: 'success' })
      setComment('')
      const res = await window.api.issue(path, selected)
      if (res.ok && res.data) {
        cacheSet(`issue:${path}:${selected}`, res.data)
        cacheInvalidate(`issues:${path}:`)
        setDetail(res.data)
      }
    }
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-0" autoSaveId="sept-issues">
      <ResizablePanel defaultSize={34} minSize={22} maxSize={55} className="flex min-w-0 flex-col border-r">
        <div className="flex items-center gap-2 border-b p-2">
          <Tabs value={state} onValueChange={setState}>
            <TabsList className="h-8">
              <TabsTrigger value="open" className="text-xs">Open</TabsTrigger>
              <TabsTrigger value="closed" className="text-xs">Closed</TabsTrigger>
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1" />
          {unread.issues > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="gap-1 text-muted-foreground"
              onClick={() => markAllRead('issue')}
              title="Mark all issues as read"
            >
              <CheckCheck className="h-3.5 w-3.5" /> {unread.issues}
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
          {issues.length === 0 && !loading && (
            <div className="p-6 text-center text-sm text-muted-foreground">No issues.</div>
          )}
          {issues.map((i) => {
            const unreadItem = isUnread('issue', i.number, i.updatedAt)
            return (
            <div
              key={i.number}
              onClick={() => {
                stickyRef.current = null
                setSelected(i.number)
              }}
              className={cn(
                'cursor-pointer border-b border-border/40 px-3 py-2.5',
                selected === i.number ? 'bg-secondary' : 'hover:bg-secondary/40'
              )}
            >
              <div className="flex items-start gap-2">
                <CircleDot
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    i.state === 'OPEN' || i.state === 'open' ? 'text-emerald-500' : 'text-purple-500'
                  )}
                />
                <span className={cn('text-sm leading-snug', unreadItem ? 'font-semibold' : 'font-medium')}>
                  {i.title}
                </span>
                {unreadItem && (
                  <span className="ml-auto mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" title="Unread" />
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-xs text-muted-foreground">
                <span className="mono">#{i.number}</span>
                <span className="flex items-center gap-1">
                  <GhAvatar login={i.author} size={14} /> {i.author}
                </span>
                <span>· {timeAgo(i.updatedAt)}</span>
                {i.comments > 0 && (
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="h-3 w-3" /> {i.comments}
                  </span>
                )}
              </div>
              {i.labels.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                  {i.labels.map((l) => (
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
            </div>
            )
          })}
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={66} className="flex min-w-0 flex-col">
        {detail ? (
          <Thread
            kind="issue"
            detail={detail}
            comment={comment}
            setComment={setComment}
            onSubmit={submit}
            sending={sending}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {selected != null ? 'Loading…' : 'Select an issue.'}
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

// Shared thread renderer used by both issues and pull requests.
export function Thread({
  kind,
  detail,
  comment,
  setComment,
  onSubmit,
  sending,
  extraHeader
}: {
  kind: 'issue' | 'pull'
  detail: IssueDetail | (IssueDetail & { headRefName?: string })
  comment: string
  setComment: (s: string) => void
  onSubmit: () => void
  sending: boolean
  extraHeader?: React.ReactNode
}): React.JSX.Element {
  const stateOpen = detail.state.toLowerCase() === 'open'
  return (
    <>
      <div className="border-b bg-card/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant={stateOpen ? 'success' : 'secondary'} className="capitalize">
                {detail.state.toLowerCase()}
              </Badge>
              <span className="mono text-xs text-muted-foreground">#{detail.number}</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold leading-tight">{detail.title}</h2>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <GhAvatar login={detail.author} size={18} />
              <span className="font-medium text-foreground">{detail.author}</span>
              <span>· opened {timeAgo(detail.createdAt)}</span>
            </div>
            {extraHeader}
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
            <a href={detail.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> GitHub
            </a>
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          <CommentCard author={detail.author} createdAt={detail.createdAt} body={detail.body} isBody />
          {detail.commentList.map((c, i) => (
            <CommentCard key={i} author={c.author} createdAt={c.createdAt} body={c.body} />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t bg-card/40 p-3">
        <MentionTextarea
          placeholder={`Comment on this ${kind}…  (# to reference, @ to mention)`}
          value={comment}
          onChange={setComment}
          onSubmit={onSubmit}
          className="mb-1 h-20 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Type <span className="mono">#</span> to link an issue/PR · <span className="mono">@</span>{' '}
            to mention
          </span>
          <Button onClick={onSubmit} disabled={!comment.trim() || sending} className="gap-1.5">
            <Send className="h-4 w-4" /> Comment
            <span className="ml-1 text-xs opacity-70">⌘↵</span>
          </Button>
        </div>
      </div>
    </>
  )
}

function CommentCard({
  author,
  createdAt,
  body,
  isBody
}: {
  author: string
  createdAt: string
  body: string
  isBody?: boolean
}): React.JSX.Element {
  return (
    <div className={cn('rounded-lg border bg-card', isBody && 'border-primary/30')}>
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5">
        <GhAvatar login={author} size={20} />
        <span className="text-xs font-medium">{author}</span>
        <span className="text-xs text-muted-foreground">· {timeAgo(createdAt)}</span>
      </div>
      <div className="p-3">
        <Markdown source={body} />
      </div>
    </div>
  )
}
