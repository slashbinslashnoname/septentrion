import { gh } from './exec'
import type {
  IssueDetail,
  IssueSummary,
  PullDetail,
  PullSummary,
  RefLookup
} from '@shared/types'

const mapLabels = (labels: any[]): { name: string; color: string }[] =>
  (labels ?? []).map((l: any) => ({ name: l.name, color: l.color }))

/**
 * Resolve a #number to a PR or an issue (they share a numbering space).
 * Tries pull request first, then issue; returns null if neither exists.
 */
export async function lookupNumber(cwd: string, number: number): Promise<RefLookup | null> {
  try {
    const fields =
      'number,title,state,author,url,isDraft,headRefName,baseRefName,additions,deletions,comments,labels,body'
    const p = JSON.parse(await gh(['pr', 'view', String(number), '--json', fields], cwd))
    return {
      type: 'pull',
      number: p.number,
      title: p.title,
      state: p.state,
      author: p.author?.login ?? 'ghost',
      url: p.url,
      isDraft: !!p.isDraft,
      headRefName: p.headRefName ?? null,
      baseRefName: p.baseRefName ?? null,
      additions: p.additions ?? 0,
      deletions: p.deletions ?? 0,
      comments: (p.comments ?? []).length,
      labels: mapLabels(p.labels),
      body: p.body ?? ''
    }
  } catch {
    /* not a PR — fall through */
  }
  try {
    const fields = 'number,title,state,author,url,comments,labels,body'
    const i = JSON.parse(await gh(['issue', 'view', String(number), '--json', fields], cwd))
    return {
      type: 'issue',
      number: i.number,
      title: i.title,
      state: i.state,
      author: i.author?.login ?? 'ghost',
      url: i.url,
      isDraft: false,
      headRefName: null,
      baseRefName: null,
      additions: null,
      deletions: null,
      comments: (i.comments ?? []).length,
      labels: mapLabels(i.labels),
      body: i.body ?? ''
    }
  } catch {
    return null
  }
}

export async function ghAuthStatus(): Promise<{ ok: boolean; user?: string }> {
  try {
    const out = await gh(['api', 'user', '--jq', '.login'])
    return { ok: true, user: out.trim() }
  } catch {
    return { ok: false }
  }
}

export async function listIssues(cwd: string, state = 'open'): Promise<IssueSummary[]> {
  const fields = 'number,title,state,author,createdAt,updatedAt,comments,labels,url'
  const out = await gh(
    ['issue', 'list', '--state', state, '--limit', '100', '--json', fields],
    cwd
  )
  const raw = JSON.parse(out) as any[]
  return raw.map((i) => ({
    number: i.number,
    title: i.title,
    state: i.state,
    author: i.author?.login ?? 'ghost',
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    comments: Array.isArray(i.comments) ? i.comments.length : (i.comments ?? 0),
    labels: (i.labels ?? []).map((l: any) => ({ name: l.name, color: l.color })),
    url: i.url
  }))
}

export async function getIssue(cwd: string, number: number): Promise<IssueDetail> {
  const fields = 'number,title,state,author,createdAt,updatedAt,comments,labels,url,body'
  const out = await gh(['issue', 'view', String(number), '--json', fields], cwd)
  const i = JSON.parse(out)
  return {
    number: i.number,
    title: i.title,
    state: i.state,
    author: i.author?.login ?? 'ghost',
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    comments: (i.comments ?? []).length,
    labels: (i.labels ?? []).map((l: any) => ({ name: l.name, color: l.color })),
    url: i.url,
    body: i.body ?? '',
    commentList: (i.comments ?? []).map((c: any) => ({
      author: c.author?.login ?? 'ghost',
      body: c.body ?? '',
      createdAt: c.createdAt
    }))
  }
}

export async function commentOnIssue(cwd: string, number: number, body: string): Promise<void> {
  await gh(['issue', 'comment', String(number), '--body', body], cwd)
}

export async function listPulls(cwd: string, state = 'open'): Promise<PullSummary[]> {
  const fields =
    'number,title,state,author,createdAt,updatedAt,isDraft,headRefName,baseRefName,additions,deletions,url'
  const out = await gh(['pr', 'list', '--state', state, '--limit', '100', '--json', fields], cwd)
  const raw = JSON.parse(out) as any[]
  return raw.map((p) => ({
    number: p.number,
    title: p.title,
    state: p.state,
    author: p.author?.login ?? 'ghost',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    isDraft: p.isDraft,
    headRefName: p.headRefName,
    baseRefName: p.baseRefName,
    additions: p.additions ?? 0,
    deletions: p.deletions ?? 0,
    url: p.url
  }))
}

export async function getPull(cwd: string, number: number): Promise<PullDetail> {
  const fields =
    'number,title,state,author,createdAt,updatedAt,isDraft,headRefName,baseRefName,additions,deletions,url,body,comments,changedFiles'
  const out = await gh(['pr', 'view', String(number), '--json', fields], cwd)
  const p = JSON.parse(out)
  return {
    number: p.number,
    title: p.title,
    state: p.state,
    author: p.author?.login ?? 'ghost',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    isDraft: p.isDraft,
    headRefName: p.headRefName,
    baseRefName: p.baseRefName,
    additions: p.additions ?? 0,
    deletions: p.deletions ?? 0,
    url: p.url,
    body: p.body ?? '',
    changedFiles: p.changedFiles ?? 0,
    commentList: (p.comments ?? []).map((c: any) => ({
      author: c.author?.login ?? 'ghost',
      body: c.body ?? '',
      createdAt: c.createdAt
    }))
  }
}

export async function getPullDiff(cwd: string, number: number): Promise<string> {
  return gh(['pr', 'diff', String(number)], cwd)
}

export async function commentOnPull(cwd: string, number: number, body: string): Promise<void> {
  await gh(['pr', 'comment', String(number), '--body', body], cwd)
}
