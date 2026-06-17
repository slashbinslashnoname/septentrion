import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { ApiResult } from '@shared/types'
import * as G from './git'
import * as GH from './github'
import * as B from './browser'
import * as S from './search'
import { checkForUpdates, quitAndInstall } from './updater'
import { addRecentRepo, markSeen, readSettings, writeSettings } from './settings'

/** Wrap a handler so every reply is a uniform { ok, data | error }. */
function handle<T>(channel: string, fn: (...args: any[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_e, ...args): Promise<ApiResult<T>> => {
    try {
      const data = await fn(...args)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  // ---- repo lifecycle ----
  handle(IPC.pickRepo, async () => {
    const win = getWindow()
    const res = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Open a Git repository'
    })
    if (res.canceled || !res.filePaths[0]) return null
    const dir = res.filePaths[0]
    if (!(await G.isRepo(dir))) throw new Error('That folder is not a Git repository.')
    const info = await G.getRepoInfo(dir)
    addRecentRepo(info.path)
    return info
  })

  handle(IPC.openRepo, async (path: string) => {
    if (!(await G.isRepo(path))) throw new Error('That folder is not a Git repository.')
    const info = await G.getRepoInfo(path)
    addRecentRepo(info.path)
    return info
  })

  handle(IPC.repoInfo, (path: string) => G.getRepoInfo(path))
  handle(IPC.recentRepos, () => readSettings().recentRepos)

  // ---- working tree ----
  handle(IPC.status, (path: string) => G.status(path))
  handle(IPC.diff, (path: string, opts: any) => {
    if (opts?.untracked && opts?.path) return G.untrackedDiff(path, opts.path)
    return G.diff(path, opts ?? {})
  })
  handle(IPC.fileContent, (path: string, file: string, rev?: string) =>
    G.fileContent(path, file, rev)
  )
  handle(IPC.fileDiff, (path: string, file: string) => G.fileBranchDiff(path, file))
  handle(IPC.stage, (path: string, files: string[]) => G.stage(path, files))
  handle(IPC.unstage, (path: string, files: string[]) => G.unstage(path, files))
  handle(IPC.discard, (path: string, files: string[]) => G.discard(path, files))
  handle(IPC.commit, (path: string, message: string, amend?: boolean) =>
    G.commit(path, message, amend)
  )

  // ---- branches ----
  handle(IPC.branches, (path: string) => G.branches(path))
  handle(IPC.checkout, (path: string, branch: string) => G.checkout(path, branch))
  handle(IPC.createBranch, (path: string, name: string) => G.createBranch(path, name))

  // ---- sync ----
  handle(IPC.fetch, (path: string) => G.fetch(path))
  handle(IPC.pull, (path: string) => G.pull(path))
  handle(IPC.push, (path: string, setUpstream?: boolean) => G.push(path, setUpstream))

  // ---- history ----
  handle(IPC.log, (path: string, limit?: number, ref?: string) => G.log(path, limit, ref))
  handle(IPC.showCommit, (path: string, hash: string) => G.diff(path, { commit: hash }))

  // ---- file browser ----
  handle(IPC.browseDir, (path: string, rel?: string) => B.browseDir(path, rel))
  handle(IPC.browseFile, (path: string, rel: string) => B.browseFile(path, rel))

  // ---- search ----
  handle(IPC.searchContent, (path: string, query: string, opts: any) =>
    S.searchContent(path, query, opts ?? {})
  )
  handle(IPC.searchFiles, (path: string, query: string) => S.searchFiles(path, query))

  // ---- worktrees ----
  handle(IPC.worktrees, (path: string) => G.worktrees(path))
  handle(IPC.addWorktree, (path: string, dest: string, opts: any) =>
    G.addWorktree(path, dest, opts ?? {})
  )
  handle(IPC.removeWorktree, (path: string, dest: string, force?: boolean) =>
    G.removeWorktree(path, dest, force)
  )

  // ---- github ----
  handle(IPC.ghAuth, () => GH.ghAuthStatus())
  handle(IPC.ghLookup, (path: string, number: number) => GH.lookupNumber(path, number))
  handle(IPC.issues, (path: string, state?: string) => GH.listIssues(path, state))
  handle(IPC.issue, (path: string, number: number) => GH.getIssue(path, number))
  handle(IPC.issueComment, (path: string, number: number, body: string) =>
    GH.commentOnIssue(path, number, body)
  )
  handle(IPC.pulls, (path: string, state?: string) => GH.listPulls(path, state))
  handle(IPC.pullView, (path: string, number: number) => GH.getPull(path, number))
  handle(IPC.pullDiff, async (path: string, number: number) =>
    G.parseDiff(await GH.getPullDiff(path, number))
  )
  handle(IPC.pullComment, (path: string, number: number, body: string) =>
    GH.commentOnPull(path, number, body)
  )

  // ---- settings ----
  handle(IPC.getSettings, () => readSettings())
  handle(IPC.setSettings, (patch: any) => writeSettings(patch))
  handle(IPC.markSeen, (repoKey: string, entries: Record<string, string>) =>
    markSeen(repoKey, entries)
  )

  // ---- auto-update ----
  handle(IPC.updateCheck, () => checkForUpdates())
  handle(IPC.updateInstall, () => quitAndInstall())
}
