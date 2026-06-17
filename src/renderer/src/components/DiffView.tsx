import { useMemo } from 'react'
import type { DiffFile } from '@shared/types'
import { cn } from '@/lib/utils'
import { highlightLine, languageForPath } from '@/lib/highlight'
import { FileIcon, FileX2, FilePlus2, FilePen } from 'lucide-react'

function statusMeta(status: string): { icon: React.ReactNode; color: string } {
  switch (status) {
    case 'added':
      return { icon: <FilePlus2 className="h-3.5 w-3.5" />, color: 'text-emerald-500' }
    case 'deleted':
      return { icon: <FileX2 className="h-3.5 w-3.5" />, color: 'text-red-500' }
    case 'renamed':
      return { icon: <FilePen className="h-3.5 w-3.5" />, color: 'text-amber-500' }
    default:
      return { icon: <FileIcon className="h-3.5 w-3.5" />, color: 'text-blue-500' }
  }
}

export function DiffView({ files }: { files: DiffFile[] }): React.JSX.Element {
  if (!files.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No changes to display.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4 p-3">
      {files.map((f, i) => (
        <DiffFileBlock key={`${f.newPath}-${i}`} file={f} />
      ))}
    </div>
  )
}

function DiffFileBlock({ file }: { file: DiffFile }): React.JSX.Element {
  const meta = statusMeta(file.status)
  const title = useMemo(() => {
    if (file.status === 'renamed' && file.oldPath !== file.newPath) {
      return `${file.oldPath} → ${file.newPath}`
    }
    return file.newPath || file.oldPath
  }, [file])

  const lang = useMemo(() => languageForPath(file.newPath || file.oldPath), [file])

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div className={cn('flex items-center gap-2 truncate text-xs font-medium', meta.color)}>
          {meta.icon}
          <span className="mono truncate text-foreground">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {file.added > 0 && <span className="text-emerald-500">+{file.added}</span>}
          {file.deleted > 0 && <span className="text-red-500">−{file.deleted}</span>}
        </div>
      </div>
      {file.binary ? (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">Binary file</div>
      ) : (
        <div className="mono overflow-x-auto text-xs leading-[1.5]">
          {file.hunks.map((h, hi) => (
            <div key={hi}>
              {h.lines.map((l, li) => (
                <div
                  key={li}
                  className={cn(
                    'flex',
                    l.type === 'add' && 'bg-emerald-500/10',
                    l.type === 'del' && 'bg-red-500/10',
                    l.type === 'hunk' && 'bg-blue-500/10 text-blue-500/90',
                    l.type === 'meta' && 'text-muted-foreground'
                  )}
                >
                  <span className="w-12 shrink-0 select-none border-r border-border/50 px-1 text-right text-muted-foreground/60">
                    {l.oldNumber ?? ''}
                  </span>
                  <span className="w-12 shrink-0 select-none border-r border-border/50 px-1 text-right text-muted-foreground/60">
                    {l.newNumber ?? ''}
                  </span>
                  <span
                    className={cn(
                      'w-4 shrink-0 select-none text-center',
                      l.type === 'add' && 'text-emerald-500',
                      l.type === 'del' && 'text-red-500'
                    )}
                  >
                    {l.type === 'add' ? '+' : l.type === 'del' ? '−' : ''}
                  </span>
                  {l.type === 'add' || l.type === 'del' || l.type === 'context' ? (
                    <span
                      className="whitespace-pre px-1 pr-4"
                      dangerouslySetInnerHTML={{
                        __html: l.content ? highlightLine(l.content, lang) : ' '
                      }}
                    />
                  ) : (
                    <span className="whitespace-pre px-1 pr-4">{l.content || ' '}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
