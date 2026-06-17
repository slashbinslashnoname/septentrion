import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useApp } from '@/store'
import { cn } from '@/lib/utils'

export function Toaster(): React.JSX.Element {
  const { toasts, dismiss } = useApp()
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-lg border bg-popover p-3 shadow-lg',
            t.variant === 'error' && 'border-destructive/40',
            t.variant === 'success' && 'border-success/40'
          )}
        >
          <div className="mt-0.5">
            {t.variant === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : t.variant === 'error' ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Info className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{t.title}</div>
            {t.description && (
              <div className="mt-0.5 break-words text-xs text-muted-foreground">{t.description}</div>
            )}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
