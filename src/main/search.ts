import { run } from './exec'
import type { ContentSearchResponse, SearchContentResult, SearchFileResult } from '@shared/types'

const MAX_CONTENT = 500
const MAX_FILES = 200

function parseGrepLine(line: string): SearchContentResult | null {
  // Format from `git grep -n`: "path:lineno:content"
  const i1 = line.indexOf(':')
  if (i1 < 0) return null
  const path = line.slice(0, i1)
  const rest = line.slice(i1 + 1)
  const i2 = rest.indexOf(':')
  if (i2 < 0) return null
  const lineNo = parseInt(rest.slice(0, i2), 10)
  if (!lineNo) return null
  return { path, line: lineNo, text: rest.slice(i2 + 1).slice(0, 400) }
}

export async function searchContent(
  cwd: string,
  query: string,
  opts: { caseSensitive?: boolean; regex?: boolean } = {}
): Promise<ContentSearchResponse> {
  if (!query.trim()) return { results: [], truncated: false }
  // -I skips binaries, --untracked also searches new non-ignored files.
  const args = ['grep', '-n', '-I', '--no-color', '--untracked']
  if (!opts.caseSensitive) args.push('-i')
  args.push(opts.regex ? '-E' : '-F')
  args.push('-e', query)
  const res = await run('git', args, { cwd })
  // git grep exits 1 when there are simply no matches — that is not an error.
  if (res.code > 1) {
    throw new Error(res.stderr.trim() || 'Search failed')
  }
  const lines = res.stdout.split('\n').filter(Boolean)
  const truncated = lines.length > MAX_CONTENT
  const results: SearchContentResult[] = []
  for (const l of lines.slice(0, MAX_CONTENT)) {
    const parsed = parseGrepLine(l)
    if (parsed) results.push(parsed)
  }
  return { results, truncated }
}

/** Subsequence fuzzy score, or null when `q` is not a subsequence of `str`. */
function fuzzyScore(str: string, q: string): number | null {
  const base = str.slice(str.lastIndexOf('/') + 1)
  let si = 0
  let score = 0
  let streak = 0
  for (let qi = 0; qi < q.length; qi++) {
    const idx = str.indexOf(q[qi], si)
    if (idx < 0) return null
    score += 1
    if (idx === si) {
      streak += 1
      score += streak * 2 // reward consecutive matches
    } else {
      streak = 0
    }
    si = idx + 1
  }
  if (base.includes(q)) score += 15 // strong bonus: appears in the filename
  if (base.startsWith(q)) score += 10
  score += Math.max(0, 20 - str.length / 6) // mild preference for shorter paths
  return score
}

export async function searchFiles(cwd: string, query: string): Promise<SearchFileResult[]> {
  const [tracked, untracked] = await Promise.all([
    run('git', ['ls-files', '-z'], { cwd }),
    run('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd })
  ])
  const files = [
    ...tracked.stdout.split('\0'),
    ...untracked.stdout.split('\0')
  ].filter(Boolean)

  const q = query.trim().toLowerCase()
  if (!q) {
    return files.slice(0, MAX_FILES).map((path) => ({ path, score: 0 }))
  }
  const scored: SearchFileResult[] = []
  for (const path of files) {
    const s = fuzzyScore(path.toLowerCase(), q)
    if (s != null) scored.push({ path, score: s })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, MAX_FILES)
}
