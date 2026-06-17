import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus } from '@shared/types'
import { Button } from '@/components/ui/button'

// Listens for auto-update events from the main process and shows a slim banner
// while downloading / when a new version is ready to install.
export function UpdateBanner(): React.JSX.Element | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => window.api.onUpdateStatus(setStatus), [])

  if (!status || dismissed) return null
  if (status.state === 'downloading') {
    return (
      <Bar>
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>Downloading update… {status.percent}%</span>
      </Bar>
    )
  }
  if (status.state === 'ready') {
    return (
      <Bar>
        <Download className="h-3.5 w-3.5" />
        <span>
          Version <span className="font-semibold">{status.version}</span> is ready to install.
        </span>
        <Button size="xs" variant="secondary" className="ml-1 h-6" onClick={() => window.api.installUpdate()}>
          Restart &amp; update
        </Button>
        <button onClick={() => setDismissed(true)} className="ml-1 opacity-70 hover:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </Bar>
    )
  }
  return null
}

function Bar({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-b bg-primary/10 px-3 py-1.5 text-xs text-foreground">
      {children}
    </div>
  )
}
