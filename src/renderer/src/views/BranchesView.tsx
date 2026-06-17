import { useCallback, useEffect, useState } from 'react'
import { Check, GitBranch, Plus, Cloud, Monitor } from 'lucide-react'
import type { Branch } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { useApi, useApp } from '@/store'
import { cn } from '@/lib/utils'

export function BranchesView(): React.JSX.Element {
  const { repo, refreshRepo, bump, toast } = useApp()
  const { call } = useApi()
  const [branches, setBranches] = useState<Branch[]>([])
  const [filter, setFilter] = useState('')
  const [newName, setNewName] = useState('')
  const [open, setOpen] = useState(false)
  const path = repo!.path

  const load = useCallback(async () => {
    const res = await call(window.api.branches(path), 'Failed to load branches')
    if (res) setBranches(res)
  }, [path, call])

  useEffect(() => {
    load()
  }, [load])

  const checkout = async (b: Branch): Promise<void> => {
    const name = b.remote ? b.name.replace(/^origin\//, '') : b.name
    const ok = await call(window.api.checkout(path, name), `Could not switch to ${name}`)
    if (ok !== undefined) {
      toast({ title: `Switched to ${name}`, variant: 'success' })
      await load()
      await refreshRepo()
      bump()
    }
  }

  const create = async (): Promise<void> => {
    if (!newName.trim()) return
    const ok = await call(window.api.createBranch(path, newName.trim()), 'Could not create branch')
    if (ok !== undefined) {
      toast({ title: `Created ${newName.trim()}`, variant: 'success' })
      setNewName('')
      setOpen(false)
      await load()
      await refreshRepo()
      bump()
    }
  }

  const local = branches.filter((b) => !b.remote)
  const remote = branches.filter((b) => b.remote)
  const match = (b: Branch): boolean => b.name.toLowerCase().includes(filter.toLowerCase())

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <Input
          placeholder="Filter branches…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 max-w-xs"
        />
        <div className="flex-1" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New branch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a branch</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              placeholder="feature/my-branch"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <p className="text-xs text-muted-foreground">
              Branches from the current <span className="mono">{repo!.currentBranch}</span> and checks
              it out.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create} disabled={!newName.trim()}>
                Create &amp; switch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        <Section title="Local" icon={<Monitor className="h-3.5 w-3.5" />}>
          {local.filter(match).map((b) => (
            <BranchRow key={b.name} branch={b} onCheckout={() => checkout(b)} />
          ))}
        </Section>
        <Section title="Remote" icon={<Cloud className="h-3.5 w-3.5" />}>
          {remote.filter(match).map((b) => (
            <BranchRow key={b.name} branch={b} onCheckout={() => checkout(b)} />
          ))}
        </Section>
      </ScrollArea>
    </div>
  )
}

function Section({
  title,
  icon,
  children
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </div>
      {children}
    </div>
  )
}

function BranchRow({
  branch,
  onCheckout
}: {
  branch: Branch
  onCheckout: () => void
}): React.JSX.Element {
  return (
    <div
      onClick={onCheckout}
      className={cn(
        'group flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-secondary/40',
        branch.current && 'bg-secondary/60'
      )}
    >
      <GitBranch className={cn('h-4 w-4', branch.current ? 'text-primary' : 'text-muted-foreground')} />
      <span className={cn('mono truncate text-xs', branch.current && 'font-semibold')}>
        {branch.name}
      </span>
      {branch.upstream && (
        <span className="mono truncate text-[10px] text-muted-foreground">↗ {branch.upstream}</span>
      )}
      <span className="mono ml-auto text-[10px] text-muted-foreground/60">{branch.head}</span>
      {branch.current ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
          Switch
        </span>
      )}
    </div>
  )
}
