import { useRef, useState } from 'react'
import { CircleDot, GitPullRequest, AtSign } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { useApp, type MentionSuggestion } from '@/store'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  placeholder?: string
  className?: string
}

// A textarea with GitHub-style autocomplete: `#` references issues/PRs and
// `@` mentions participants. ⌘/Ctrl+↵ submits.
export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  className
}: Props): React.JSX.Element {
  const { suggestMentions } = useApp()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MentionSuggestion[]>([])
  const [active, setActive] = useState(0)
  const tokenRef = useRef<{ start: number; end: number } | null>(null)

  const close = (): void => {
    setOpen(false)
    setItems([])
    tokenRef.current = null
  }

  // Inspect the word immediately before the caret for a #/@ trigger.
  const detect = (): void => {
    const el = ref.current
    if (!el || el.selectionStart !== el.selectionEnd) return close()
    const caret = el.selectionStart
    const m = el.value.slice(0, caret).match(/(^|\s)([#@])([\w-]*)$/)
    if (!m) return close()
    const trigger = m[2] as '#' | '@'
    const sugg = suggestMentions(trigger, m[3])
    if (!sugg.length) return close()
    tokenRef.current = { start: caret - m[3].length - 1, end: caret }
    setItems(sugg)
    setActive(0)
    setOpen(true)
  }

  const insert = (item: MentionSuggestion): void => {
    const el = ref.current
    if (!el || !tokenRef.current) return
    const { start, end } = tokenRef.current
    const v = el.value
    const next = `${v.slice(0, start)}${item.value} ${v.slice(end)}`
    onChange(next)
    close()
    const caret = start + item.value.length + 1
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (open && items.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => (a + 1) % items.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => (a - 1 + items.length) % items.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insert(items[active])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onSubmit?.()
    }
  }

  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-lg">
          {items.map((it, i) => (
            <button
              key={`${it.value}-${i}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                insert(it)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm',
                i === active ? 'bg-secondary' : 'hover:bg-secondary/50'
              )}
            >
              {it.kind === 'user' ? (
                <AtSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : it.refType === 'pull' ? (
                <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <CircleDot className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              )}
              <span className="mono shrink-0 text-xs text-muted-foreground">{it.value}</span>
              <span className="truncate">{it.primary}</span>
            </button>
          ))}
        </div>
      )}
      <Textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={detect}
        onClick={detect}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(close, 120)}
      />
    </div>
  )
}
