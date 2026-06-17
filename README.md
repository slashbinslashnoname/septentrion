<p align="center">
  <img src="assets/logo.png" alt="Septentrion" width="180" />
</p>

<h1 align="center">Septentrion</h1>

<p align="center">
  A desktop <strong>Git client</strong> — workspaces, diffs, issues &amp; pull requests, all in one place.
</p>

<p align="center">
  Built with <strong>electron-vite · React · TypeScript · Tailwind · shadcn/ui</strong>
</p>

---

Manage workspaces, review diffs and code, browse history, and work GitHub issues &
pull requests — including reading and posting comments — without leaving the app.

## Features

- **Repositories** — open any local repo via folder picker; recent repos remembered.
- **Changes** — staged / unstaged / untracked lists, stage / unstage / discard per file or all,
  side-by-side line-numbered **diff viewer**, and commit (⌘↵).
- **History** — browse the commit log with refs/tags and view each commit's full diff.
- **Branches** — local & remote branches, filter, one-click checkout, create new branch.
- **Workspaces** — full **git worktree** support: list, add (new or existing branch),
  open, and remove linked worktrees so you can work several branches at once.
- **Sync** — fetch, pull (ff-only), push (auto sets upstream), with ahead/behind indicators.
- **Issues** (GitHub) — list open/closed/all, read the thread, **post comments**.
- **Pull Requests** (GitHub) — list, read the conversation, view the full **diff**, **post comments**.
- **Light / Dark / System** theme, persisted.

## How it works

All Git work happens in the Electron **main process** by spawning `git` directly (argv arrays,
no shell — no injection surface). GitHub data uses the authenticated **`gh` CLI** with
`--json` output. The renderer talks to main over a typed, contextIsolation-safe IPC bridge
(`window.api`, defined in `src/preload`). Every IPC reply is a uniform `{ ok, data | error }`.

## Requirements

- **Node 18+** and **pnpm**
- **git** on PATH
- **[GitHub CLI](https://cli.github.com/) (`gh`)**, authenticated (`gh auth login`) — required
  only for the Issues / Pull Requests tabs. Those tabs are disabled when no GitHub remote is found.

## Develop

```bash
pnpm install      # electron's binary postinstall is pre-approved in package.json
pnpm dev          # hot-reloading dev build
pnpm typecheck    # tsc for main+preload and renderer
pnpm build        # production bundles into out/
pnpm preview      # run the production build
pnpm package      # build distributables via electron-builder
```

## CI & Releases

GitHub Actions (`.github/workflows/build.yml`):

- **Every push / PR to `main`** → typecheck + bundle build on Ubuntu.
- **Pushing a `v*` tag** → builds native installers on macOS, Windows and Linux
  (`dmg`/`zip`, `nsis`, `AppImage`) and publishes them to a GitHub **Release**
  via electron-builder (`GITHUB_TOKEN`, no extra secrets needed).

Cut a release:

```bash
npm version patch          # bumps package.json + creates a git tag (e.g. v0.1.1)
git push --follow-tags     # pushes the commit and the tag → triggers the release job
```

Artifacts are unsigned (no Apple/Windows certificates configured). To sign,
add the usual electron-builder secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`, …) and
remove `identity: null` / `CSC_IDENTITY_AUTO_DISCOVERY: false`.

### Installing on macOS

The macOS build is **ad-hoc signed but not notarized** (no paid Apple Developer
account). On first launch macOS will say the developer can't be verified:

- **Right-click the app → Open → Open**, or
- System Settings → Privacy & Security → "Open Anyway".

If you ever see *"Septentrion is damaged and can't be opened"* (older quarantine
state), clear the quarantine flag once:

```bash
xattr -cr /Applications/Septentrion.app
```

Full notarization (zero prompts) requires an Apple Developer ID — add
`APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` secrets and a
`notarize` config to enable it.

## Project layout

```
src/
  shared/        types.ts + ipc.ts — the IPC contract, shared by main & renderer
  main/          index.ts (window) · ipc.ts (handlers) · git.ts · github.ts · exec.ts · settings.ts
  preload/       index.ts — contextBridge exposing typed window.api
  renderer/
    src/
      App.tsx · store.tsx (context: repo/theme/toasts)
      components/   TitleBar · Sidebar · DiffView · Toaster · ui/* (shadcn)
      views/        Welcome · Changes · History · Branches · Worktrees · Issues · Pulls
```

## Notes

- The renderer bundle is currently a single chunk (~670 kB). Fine for a desktop app; can be
  code-split later if desired.
- Diff rendering is read-only (no per-hunk staging yet) — a natural next addition.
