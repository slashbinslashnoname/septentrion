// Shared types used by both the main and renderer processes.
// These describe the IPC contract exposed on `window.api`.

export interface RepoInfo {
  path: string
  name: string
  currentBranch: string
  head: string
  remoteUrl: string | null
  /** owner/name parsed from the GitHub remote, when available */
  nameWithOwner: string | null
  ahead: number
  behind: number
}

export interface FileStatus {
  path: string
  /** raw two-char XY porcelain code, e.g. " M", "A ", "??" */
  code: string
  staged: boolean
  unstaged: boolean
  untracked: boolean
  /** human label: modified | added | deleted | renamed | untracked | conflicted */
  label: string
  origPath?: string
}

export interface StatusResult {
  files: FileStatus[]
  branch: string
  ahead: number
  behind: number
  clean: boolean
}

export interface Branch {
  name: string
  current: boolean
  remote: boolean
  upstream: string | null
  head: string
}

export interface Commit {
  hash: string
  shortHash: string
  subject: string
  body: string
  author: string
  authorEmail: string
  date: string
  relativeDate: string
  refs: string
}

export interface Worktree {
  path: string
  head: string
  branch: string | null
  bare: boolean
  detached: boolean
  locked: boolean
  /** true when this worktree is the directory currently open */
  isCurrent: boolean
}

export interface DiffLine {
  type: 'add' | 'del' | 'context' | 'hunk' | 'meta'
  content: string
  oldNumber: number | null
  newNumber: number | null
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface DiffFile {
  oldPath: string
  newPath: string
  hunks: DiffHunk[]
  binary: boolean
  added: number
  deleted: number
  status: string
}

export interface FileBranchDiff {
  /** the ref the file was compared against (e.g. "main" or "HEAD") */
  base: string
  /** true when the current branch is the default branch */
  onDefault: boolean
  files: DiffFile[]
}

export interface DirEntry {
  name: string
  /** path relative to the repo root */
  path: string
  type: 'dir' | 'file'
}

export interface FileBlob {
  kind: 'text' | 'image' | 'binary'
  content: string
  /** for image files: a `data:` URL ready to drop into <img src> */
  dataUrl: string | null
  truncated: boolean
  size: number
}

export interface SearchContentResult {
  path: string
  line: number
  text: string
}

export interface ContentSearchResponse {
  results: SearchContentResult[]
  truncated: boolean
}

export interface SearchFileResult {
  path: string
  score: number
}

export interface RefLookup {
  type: 'pull' | 'issue'
  number: number
  title: string
  state: string
  author: string
  url: string
  isDraft: boolean
  headRefName: string | null
  baseRefName: string | null
  additions: number | null
  deletions: number | null
  comments: number
  labels: { name: string; color: string }[]
  body: string
}

export interface GhUser {
  login: string
  avatarUrl?: string
}

export interface IssueSummary {
  number: number
  title: string
  state: string
  author: string
  createdAt: string
  updatedAt: string
  comments: number
  labels: { name: string; color: string }[]
  url: string
}

export interface Comment {
  author: string
  body: string
  createdAt: string
}

export interface IssueDetail extends IssueSummary {
  body: string
  commentList: Comment[]
}

export interface PullSummary {
  number: number
  title: string
  state: string
  author: string
  createdAt: string
  updatedAt: string
  isDraft: boolean
  headRefName: string
  baseRefName: string
  additions: number
  deletions: number
  url: string
}

export interface PullDetail extends PullSummary {
  body: string
  commentList: Comment[]
  changedFiles: number
}

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
}

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  recentRepos: string[]
  /** repoKey → ("issue:123" | "pull:45") → updatedAt last seen by the user */
  seen: Record<string, Record<string, string>>
}

export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'none' }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }
