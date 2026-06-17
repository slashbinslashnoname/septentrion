import { useEffect, useState } from 'react'
import {
  CircleDot,
  FileDiff,
  FolderTree,
  GitBranch,
  GitPullRequest,
  History,
  Layers
} from 'lucide-react'
import { useApp, type Section } from '@/store'
import { cn } from '@/lib/utils'

interface NavItem {
  id: Section
  label: string
  icon: React.ReactNode
  github?: boolean
}

const ITEMS: NavItem[] = [
  { id: 'changes', label: 'Changes', icon: <FileDiff className="h-4 w-4" /> },
  { id: 'history', label: 'History', icon: <History className="h-4 w-4" /> },
  { id: 'browser', label: 'Browser', icon: <FolderTree className="h-4 w-4" /> },
  { id: 'branches', label: 'Branches', icon: <GitBranch className="h-4 w-4" /> },
  { id: 'worktrees', label: 'Workspaces', icon: <Layers className="h-4 w-4" /> },
  { id: 'issues', label: 'Issues', icon: <CircleDot className="h-4 w-4" />, github: true },
  { id: 'pulls', label: 'Pull Requests', icon: <GitPullRequest className="h-4 w-4" />, github: true }
]

export function Sidebar(): React.JSX.Element {
  const { section, setSection, repo, unread } = useApp()
  const [changeCount, setChangeCount] = useState<number | null>(null)

  useEffect(() => {
    if (!repo) return
    window.api.status(repo.path).then((res) => {
      if (res.ok && res.data) setChangeCount(res.data.files.length)
    })
  }, [repo, section])

  const hasGithub = !!repo?.nameWithOwner

  return (
    <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r bg-card/30 p-2">
      {ITEMS.map((item) => {
        const disabled = item.github && !hasGithub
        const active = section === item.id
        const unreadCount =
          item.id === 'issues' ? unread.issues : item.id === 'pulls' ? unread.pulls : 0
        return (
          <button
            key={item.id}
            disabled={disabled}
            onClick={() => setSection(item.id)}
            className={cn(
              'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-secondary font-medium text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent'
            )}
            title={disabled ? 'No GitHub remote detected' : undefined}
          >
            <span className={cn(active ? 'text-primary' : 'text-muted-foreground')}>{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.id === 'changes' && changeCount != null && changeCount > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 text-xs font-medium text-primary">
                {changeCount}
              </span>
            )}
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </button>
        )
      })}

      <div className="flex-1" />
      {repo && (
        <div className="truncate px-3 py-2 text-[10px] text-muted-foreground" title={repo.path}>
          {repo.nameWithOwner ?? repo.path}
        </div>
      )}
    </nav>
  )
}
