import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'

marked.setOptions({ gfm: true, breaks: true })

/**
 * Render GitHub-flavoured markdown (issue/PR bodies & comments) including
 * embedded images. Output is sanitised; links open in the external browser.
 */
export function Markdown({
  source,
  className
}: {
  source: string
  className?: string
}): React.JSX.Element {
  const html = useMemo(() => {
    if (!source || !source.trim()) return ''
    const raw = marked.parse(source, { async: false }) as string
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] })
  }, [source])

  const onClick = (e: React.MouseEvent): void => {
    const a = (e.target as HTMLElement).closest('a')
    const href = a?.getAttribute('href')
    if (href && /^https?:\/\//.test(href)) {
      e.preventDefault()
      window.open(href, '_blank')
    }
  }

  if (!html) {
    return <span className="text-muted-foreground">No description provided.</span>
  }
  return (
    <div
      className={cn('markdown', className)}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
