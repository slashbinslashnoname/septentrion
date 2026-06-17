import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  ApiResult,
  Branch,
  Commit,
  ContentSearchResponse,
  DiffFile,
  DirEntry,
  FileBlob,
  FileBranchDiff,
  IssueDetail,
  IssueSummary,
  PullDetail,
  PullSummary,
  RefLookup,
  RepoInfo,
  SearchFileResult,
  Settings,
  StatusResult,
  Worktree
} from '../shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<ApiResult<T>> =>
  ipcRenderer.invoke(channel, ...args)

const api = {
  // repo
  pickRepo: () => invoke<RepoInfo | null>(IPC.pickRepo),
  openRepo: (path: string) => invoke<RepoInfo>(IPC.openRepo, path),
  repoInfo: (path: string) => invoke<RepoInfo>(IPC.repoInfo, path),
  recentRepos: () => invoke<string[]>(IPC.recentRepos),
  // working tree
  status: (path: string) => invoke<StatusResult>(IPC.status, path),
  diff: (path: string, opts?: { staged?: boolean; path?: string; untracked?: boolean }) =>
    invoke<DiffFile[]>(IPC.diff, path, opts),
  fileContent: (path: string, file: string, rev?: string) =>
    invoke<string>(IPC.fileContent, path, file, rev),
  fileDiff: (path: string, file: string) => invoke<FileBranchDiff>(IPC.fileDiff, path, file),
  stage: (path: string, files: string[]) => invoke<void>(IPC.stage, path, files),
  unstage: (path: string, files: string[]) => invoke<void>(IPC.unstage, path, files),
  discard: (path: string, files: string[]) => invoke<void>(IPC.discard, path, files),
  commit: (path: string, message: string, amend?: boolean) =>
    invoke<void>(IPC.commit, path, message, amend),
  // branches
  branches: (path: string) => invoke<Branch[]>(IPC.branches, path),
  checkout: (path: string, branch: string) => invoke<void>(IPC.checkout, path, branch),
  createBranch: (path: string, name: string) => invoke<void>(IPC.createBranch, path, name),
  // sync
  fetch: (path: string) => invoke<string>(IPC.fetch, path),
  pull: (path: string) => invoke<string>(IPC.pull, path),
  push: (path: string, setUpstream?: boolean) => invoke<string>(IPC.push, path, setUpstream),
  // history
  log: (path: string, limit?: number, ref?: string) => invoke<Commit[]>(IPC.log, path, limit, ref),
  showCommit: (path: string, hash: string) => invoke<DiffFile[]>(IPC.showCommit, path, hash),
  // file browser
  browseDir: (path: string, rel?: string) => invoke<DirEntry[]>(IPC.browseDir, path, rel),
  browseFile: (path: string, rel: string) => invoke<FileBlob>(IPC.browseFile, path, rel),
  // search
  searchContent: (
    path: string,
    query: string,
    opts?: { caseSensitive?: boolean; regex?: boolean }
  ) => invoke<ContentSearchResponse>(IPC.searchContent, path, query, opts),
  searchFiles: (path: string, query: string) =>
    invoke<SearchFileResult[]>(IPC.searchFiles, path, query),
  // worktrees
  worktrees: (path: string) => invoke<Worktree[]>(IPC.worktrees, path),
  addWorktree: (path: string, dest: string, opts?: { branch?: string; newBranch?: string }) =>
    invoke<void>(IPC.addWorktree, path, dest, opts),
  removeWorktree: (path: string, dest: string, force?: boolean) =>
    invoke<void>(IPC.removeWorktree, path, dest, force),
  // github
  ghAuth: () => invoke<{ ok: boolean; user?: string }>(IPC.ghAuth),
  ghLookup: (path: string, number: number) => invoke<RefLookup | null>(IPC.ghLookup, path, number),
  issues: (path: string, state?: string) => invoke<IssueSummary[]>(IPC.issues, path, state),
  issue: (path: string, number: number) => invoke<IssueDetail>(IPC.issue, path, number),
  issueComment: (path: string, number: number, body: string) =>
    invoke<void>(IPC.issueComment, path, number, body),
  pulls: (path: string, state?: string) => invoke<PullSummary[]>(IPC.pulls, path, state),
  pullDetail: (path: string, number: number) => invoke<PullDetail>(IPC.pullView, path, number),
  pullDiff: (path: string, number: number) => invoke<DiffFile[]>(IPC.pullDiff, path, number),
  pullComment: (path: string, number: number, body: string) =>
    invoke<void>(IPC.pullComment, path, number, body),
  // settings
  getSettings: () => invoke<Settings>(IPC.getSettings),
  setSettings: (patch: Partial<Settings>) => invoke<Settings>(IPC.setSettings, patch),
  markSeen: (repoKey: string, entries: Record<string, string>) =>
    invoke<Settings>(IPC.markSeen, repoKey, entries)
}

export type SeptentrionApi = typeof api

contextBridge.exposeInMainWorld('api', api)
