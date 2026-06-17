import { useEffect, useState } from 'react'
import type { Commit, DiffFile } from '@shared/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { DiffView } from '@/components/DiffView'
import { useApi, useApp } from '@/store'
import { cn } from '@/lib/utils'

export function HistoryView(): React.JSX.Element {
  const { repo, rev } = useApp()
  const { call } = useApi()
  const [commits, setCommits] = useState<Commit[]>([])
  const [selected, setSelected] = useState<Commit | null>(null)
  const [diff, setDiff] = useState<DiffFile[]>([])
  const path = repo!.path

  useEffect(() => {
    call(window.api.log(path, 150), 'Failed to load history').then((res) => {
      if (res) {
        setCommits(res)
        setSelected((prev) => prev ?? res[0] ?? null)
      }
    })
  }, [path, rev, call])

  useEffect(() => {
    if (!selected) return
    window.api.showCommit(path, selected.hash).then((res) => setDiff(res.ok && res.data ? res.data : []))
  }, [selected, path])

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-0" autoSaveId="sept-history">
      <ResizablePanel defaultSize={34} minSize={22} maxSize={55} className="flex min-w-0 flex-col border-r">
        <ScrollArea className="flex-1">
          {commits.map((c) => {
            const isSel = selected?.hash === c.hash
            const refs = c.refs ? c.refs.split(', ').filter(Boolean) : []
            return (
              <div
                key={c.hash}
                onClick={() => setSelected(c)}
                className={cn(
                  'cursor-pointer border-b border-border/40 px-3 py-2.5',
                  isSel ? 'bg-secondary' : 'hover:bg-secondary/40'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{c.subject}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="mono">{c.shortHash}</span>
                  <span>·</span>
                  <span className="truncate">{c.author}</span>
                  <span>·</span>
                  <span className="shrink-0">{c.relativeDate}</span>
                </div>
                {refs.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {refs.map((r) => (
                      <Badge key={r} variant="outline" className="px-1.5 py-0 text-[10px]">
                        {r.replace('HEAD -> ', '')}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={66} className="min-w-0">
        {selected ? (
          <ScrollArea className="h-full">
            <div className="border-b bg-card/40 p-4">
              <div className="text-sm font-semibold">{selected.subject}</div>
              {selected.body && (
                <pre className="mono mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                  {selected.body}
                </pre>
              )}
              <div className="mt-2 text-xs text-muted-foreground">
                <span className="mono">{selected.shortHash}</span> · {selected.author} &lt;
                {selected.authorEmail}&gt; · {selected.relativeDate}
              </div>
            </div>
            <DiffView files={diff} />
          </ScrollArea>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a commit.
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
