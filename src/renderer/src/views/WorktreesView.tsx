import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, Layers, Lock, Plus, Trash2 } from 'lucide-react'
import type { Worktree } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { useApi, useApp } from '@/store'
import { cn } from '@/lib/utils'

export function WorktreesView(): React.JSX.Element {
  const { repo, setRepo, bump, toast } = useApp()
  const { call } = useApi()
  const [worktrees, setWorktrees] = useState<Worktree[]>([])
  const [open, setOpen] = useState(false)
  const [dest, setDest] = useState('')
  const [branch, setBranch] = useState('')
  const [newBranch, setNewBranch] = useState(true)
  const path = repo!.path

  const load = useCallback(async () => {
    const res = await call(window.api.worktrees(path), 'Failed to load workspaces')
    if (res) setWorktrees(res)
  }, [path, call])

  useEffect(() => {
    load()
  }, [load])

  const add = async (): Promise<void> => {
    if (!dest.trim() || !branch.trim()) return
    const opts = newBranch ? { newBranch: branch.trim() } : { branch: branch.trim() }
    const ok = await call(window.api.addWorktree(path, dest.trim(), opts), 'Could not add workspace')
    if (ok !== undefined) {
      toast({ title: 'Workspace added', description: dest.trim(), variant: 'success' })
      setOpen(false)
      setDest('')
      setBranch('')
      await load()
    }
  }

  const remove = async (wt: Worktree): Promise<void> => {
    const ok = await call(window.api.removeWorktree(path, wt.path, true), 'Could not remove workspace')
    if (ok !== undefined) {
      toast({ title: 'Workspace removed', variant: 'success' })
      await load()
    }
  }

  const openWorktree = async (wt: Worktree): Promise<void> => {
    const info = await call(window.api.openRepo(wt.path), 'Could not open workspace')
    if (info) {
      setRepo(info)
      bump()
      toast({ title: `Switched to ${wt.branch ?? wt.head}`, variant: 'success' })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4 text-primary" />
          Workspaces
          <span className="text-xs text-muted-foreground">
            git worktrees — check out multiple branches at once
          </span>
        </div>
        <div className="flex-1" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a workspace</DialogTitle>
              <DialogDescription>
                Creates a linked git worktree in a separate folder so you can work on another branch
                without stashing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Folder path</Label>
                <Input
                  placeholder="../my-repo-feature"
                  value={dest}
                  onChange={(e) => setDest(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Branch name</Label>
                <Input
                  placeholder={newBranch ? 'new-branch-name' : 'existing-branch'}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newBranch}
                  onChange={(e) => setNewBranch(e.target.checked)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                Create a new branch
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={add} disabled={!dest.trim() || !branch.trim()}>
                Add workspace
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-3">
          {worktrees.map((wt) => (
            <div
              key={wt.path}
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-card p-3',
                wt.isCurrent && 'border-primary/40 ring-1 ring-primary/20'
              )}
            >
              <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="mono truncate text-sm font-medium">
                    {wt.branch ?? `(detached ${wt.head})`}
                  </span>
                  {wt.isCurrent && <Badge variant="success" className="px-1.5 py-0 text-[10px]">current</Badge>}
                  {wt.locked && (
                    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                      <Lock className="h-3 w-3" /> locked
                    </Badge>
                  )}
                  {wt.bare && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">bare</Badge>}
                </div>
                <div className="mono mt-0.5 truncate text-xs text-muted-foreground" title={wt.path}>
                  {wt.path}
                </div>
              </div>
              {!wt.isCurrent && (
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openWorktree(wt)}>
                  <FolderOpen className="h-4 w-4" /> Open
                </Button>
              )}
              {!wt.isCurrent && !wt.bare && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(wt)}
                  title="Remove workspace"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
