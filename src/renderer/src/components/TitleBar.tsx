import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronsUpDown,
  FolderGit2,
  GitBranch,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Sun
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useApi, useApp, type Theme } from '@/store'
import { cn } from '@/lib/utils'

export function TitleBar(): React.JSX.Element {
  const { repo, setRepo, refreshRepo, theme, setTheme, toast, bump, openSearch } = useApp()
  const { call } = useApi()
  const [recent, setRecent] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    window.api.recentRepos().then((res) => res.ok && setRecent(res.data ?? []))
  }, [repo])

  const openPicker = async (): Promise<void> => {
    const info = await call(window.api.pickRepo(), 'Could not open repository')
    if (info) {
      setRepo(info)
      bump()
    }
  }

  const openPath = async (path: string): Promise<void> => {
    const info = await call(window.api.openRepo(path), 'Could not open repository')
    if (info) {
      setRepo(info)
      bump()
    }
  }

  const sync = async (kind: 'fetch' | 'pull' | 'push'): Promise<void> => {
    if (!repo) return
    setBusy(kind)
    const fn =
      kind === 'fetch'
        ? window.api.fetch(repo.path)
        : kind === 'pull'
          ? window.api.pull(repo.path)
          : window.api.push(repo.path, true)
    const out = await call(fn, `${kind} failed`)
    setBusy(null)
    if (out !== undefined) {
      toast({ title: `${kind[0].toUpperCase()}${kind.slice(1)} complete`, variant: 'success' })
      await refreshRepo()
      bump()
    }
  }

  const themeIcon =
    theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />

  return (
    <header className="drag flex h-12 shrink-0 items-center gap-2 border-b bg-card/60 pl-20 pr-3">
      <div className="flex items-center gap-1.5 pr-1 text-sm font-semibold tracking-tight">
        <span className="text-primary">✦</span>
        <span>Septentrion</span>
      </div>

      {/* repo switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="no-drag h-8 gap-2 font-medium">
            <FolderGit2 className="h-4 w-4 text-muted-foreground" />
            {repo ? repo.name : 'Open repository'}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuItem onClick={openPicker}>
            <FolderGit2 className="h-4 w-4" /> Open a repository…
          </DropdownMenuItem>
          {recent.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Recent</DropdownMenuLabel>
              {recent.map((p) => (
                <DropdownMenuItem key={p} onClick={() => openPath(p)} className="text-xs">
                  <span className="truncate">{p}</span>
                  {repo?.path === p && <Check className="ml-auto h-3.5 w-3.5" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {repo && (
        <div className="no-drag flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{repo.currentBranch}</span>
          {repo.behind > 0 && <span className="flex items-center">↓{repo.behind}</span>}
          {repo.ahead > 0 && <span className="flex items-center">↑{repo.ahead}</span>}
        </div>
      )}

      {repo && (
        <button
          onClick={() => openSearch('')}
          className="no-drag mx-2 flex h-8 max-w-sm flex-1 items-center gap-2 rounded-md border bg-background/60 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search code…</span>
          <span className="ml-auto flex items-center gap-0.5">
            <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">⌘P</kbd>
          </span>
        </button>
      )}

      <div className="flex-1" />

      {repo && (
        <div className="no-drag flex items-center gap-1">
          <SyncButton
            icon={<RefreshCw className={cn('h-4 w-4', busy === 'fetch' && 'animate-spin')} />}
            label="Fetch"
            onClick={() => sync('fetch')}
            disabled={!!busy}
          />
          <SyncButton
            icon={<ArrowDownToLine className="h-4 w-4" />}
            label={`Pull${repo.behind ? ` (${repo.behind})` : ''}`}
            onClick={() => sync('pull')}
            disabled={!!busy}
          />
          <SyncButton
            icon={<ArrowUpFromLine className="h-4 w-4" />}
            label={`Push${repo.ahead ? ` (${repo.ahead})` : ''}`}
            onClick={() => sync('push')}
            disabled={!!busy}
          />
        </div>
      )}

      {/* theme */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="no-drag h-8 w-8">
            {themeIcon}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(['light', 'dark', 'system'] as Theme[]).map((t) => (
            <DropdownMenuItem key={t} onClick={() => setTheme(t)} className="capitalize">
              {t === 'light' ? <Sun className="h-4 w-4" /> : t === 'dark' ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
              {t}
              {theme === t && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

function SyncButton({
  icon,
  label,
  onClick,
  disabled
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={onClick} disabled={disabled}>
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
