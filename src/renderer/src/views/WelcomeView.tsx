import { useEffect, useState } from 'react'
import { FolderGit2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApi, useApp } from '@/store'

export function WelcomeView(): React.JSX.Element {
  const { setRepo, bump } = useApp()
  const { call } = useApi()
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    window.api.recentRepos().then((res) => res.ok && setRecent(res.data ?? []))
  }, [])

  const open = async (path?: string): Promise<void> => {
    const info = await call(
      path ? window.api.openRepo(path) : window.api.pickRepo(),
      'Could not open repository'
    )
    if (info) {
      setRepo(info)
      bump()
    }
  }

  return (
    <div className="flex h-full flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 text-5xl">✦</div>
        <h1 className="text-2xl font-semibold tracking-tight">Septentrion</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A desktop Git client — workspaces, diffs, issues &amp; pull requests, all in one place.
        </p>

        <Button className="mt-6 gap-2" onClick={() => open()}>
          <FolderGit2 className="h-4 w-4" />
          Open a repository
        </Button>

        {recent.length > 0 && (
          <div className="mt-8 text-left">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Recent
            </div>
            <div className="flex flex-col gap-1">
              {recent.map((p) => (
                <button
                  key={p}
                  onClick={() => open(p)}
                  className="flex items-center gap-2 truncate rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/50"
                >
                  <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{p}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
