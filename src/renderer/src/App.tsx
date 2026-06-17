import { useEffect } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppProvider, useApp } from '@/store'
import { Toaster } from '@/components/Toaster'
import { TitleBar } from '@/components/TitleBar'
import { Sidebar } from '@/components/Sidebar'
import { SearchPalette } from '@/components/SearchPalette'
import { WelcomeView } from '@/views/WelcomeView'
import { ChangesView } from '@/views/ChangesView'
import { HistoryView } from '@/views/HistoryView'
import { BrowserView } from '@/views/BrowserView'
import { BranchesView } from '@/views/BranchesView'
import { WorktreesView } from '@/views/WorktreesView'
import { IssuesView } from '@/views/IssuesView'
import { PullsView } from '@/views/PullsView'

function Workspace(): React.JSX.Element {
  const { repo, section, openSearch, setSearchOpen } = useApp()

  // Global search shortcuts: ⌘P / ⌘⇧F (content) and ⌘P opens file-finder.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        if (repo) openSearch('@')
      } else if ((e.key === 'f' || e.key === 'F') && e.shiftKey) {
        e.preventDefault()
        if (repo) openSearch('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [repo, openSearch, setSearchOpen])

  if (!repo) return <WelcomeView />

  return (
    <div className="flex h-full min-h-0 flex-1">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-hidden">
        {section === 'changes' && <ChangesView />}
        {section === 'history' && <HistoryView />}
        {section === 'browser' && <BrowserView />}
        {section === 'branches' && <BranchesView />}
        {section === 'worktrees' && <WorktreesView />}
        {section === 'issues' && <IssuesView />}
        {section === 'pulls' && <PullsView />}
      </main>
    </div>
  )
}

export default function App(): React.JSX.Element {
  return (
    <AppProvider>
      <TooltipProvider delayDuration={300}>
        <div className="flex h-full flex-col">
          <TitleBar />
          <Workspace />
        </div>
        <SearchPalette />
        <Toaster />
      </TooltipProvider>
    </AppProvider>
  )
}
