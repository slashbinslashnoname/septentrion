// Tiny in-memory cache for GitHub data (issues / pull requests).
// gh CLI calls are slow, so we keep results around for the session and
// only refetch when the user explicitly refreshes or after a mutation.

interface Entry {
  at: number
  data: unknown
}

const store = new Map<string, Entry>()

// Default freshness window: entries older than this are treated as missing
// on read, so a long-lived window eventually revalidates on its own.
const DEFAULT_TTL = 5 * 60 * 1000

export function cacheGet<T>(key: string, ttl = DEFAULT_TTL): T | undefined {
  const hit = store.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > ttl) {
    store.delete(key)
    return undefined
  }
  return hit.data as T
}

export function cacheSet(key: string, data: unknown): void {
  store.set(key, { at: Date.now(), data })
}

/** Drop every entry whose key starts with `prefix` (e.g. on refresh). */
export function cacheInvalidate(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}
