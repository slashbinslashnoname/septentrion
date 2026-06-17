// Canonical list of IPC channel names, shared so main + preload stay in sync.
export const IPC = {
  // app / repo lifecycle
  pickRepo: 'repo:pick',
  openRepo: 'repo:open',
  repoInfo: 'repo:info',
  recentRepos: 'repo:recent',
  // working tree
  status: 'git:status',
  diff: 'git:diff',
  fileContent: 'git:fileContent',
  fileDiff: 'git:fileDiff',
  stage: 'git:stage',
  unstage: 'git:unstage',
  discard: 'git:discard',
  commit: 'git:commit',
  // branches
  branches: 'git:branches',
  checkout: 'git:checkout',
  createBranch: 'git:createBranch',
  // sync
  fetch: 'git:fetch',
  pull: 'git:pull',
  push: 'git:push',
  // history
  log: 'git:log',
  showCommit: 'git:showCommit',
  // file browser
  browseDir: 'browse:dir',
  browseFile: 'browse:file',
  // search
  searchContent: 'search:content',
  searchFiles: 'search:files',
  // worktrees
  worktrees: 'git:worktrees',
  addWorktree: 'git:addWorktree',
  removeWorktree: 'git:removeWorktree',
  // github
  ghAuth: 'gh:auth',
  ghLookup: 'gh:lookup',
  issues: 'gh:issues',
  issue: 'gh:issue',
  issueComment: 'gh:issueComment',
  pulls: 'gh:pulls',
  pullView: 'gh:pull',
  pullDiff: 'gh:pullDiff',
  pullComment: 'gh:pullComment',
  // settings
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  markSeen: 'notif:markSeen',
  // auto-update
  updateStatus: 'update:status',
  updateCheck: 'update:check',
  updateInstall: 'update:install'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
