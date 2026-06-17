import { readdir, readFile, stat } from 'node:fs/promises'
import { join, normalize, relative, resolve, sep } from 'node:path'
import type { DirEntry, FileBlob } from '@shared/types'

// Folders we never want to descend into when browsing a working tree.
const IGNORED = new Set(['.git', 'node_modules', '.DS_Store'])

/** Reject any path that escapes the repo root (path-traversal guard). */
function safeJoin(root: string, rel: string): string {
  const target = resolve(root, normalize(rel))
  const rootResolved = resolve(root)
  if (target !== rootResolved && !target.startsWith(rootResolved + sep)) {
    throw new Error('Path is outside the repository.')
  }
  return target
}

export async function browseDir(root: string, rel = ''): Promise<DirEntry[]> {
  const dir = safeJoin(root, rel)
  const entries = await readdir(dir, { withFileTypes: true })
  const out: DirEntry[] = []
  for (const e of entries) {
    if (IGNORED.has(e.name)) continue
    out.push({
      name: e.name,
      path: relative(root, join(dir, e.name)),
      type: e.isDirectory() ? 'dir' : 'file'
    })
  }
  // Directories first, then files, each alphabetical (case-insensitive).
  out.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
  return out
}

const MAX_BYTES = 2_000_000
const MAX_IMAGE_BYTES = 16_000_000

// Image extensions the renderer can display via a data: URL.
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  svg: 'image/svg+xml'
}

function extOf(rel: string): string {
  const base = rel.split('/').pop() ?? ''
  return base.includes('.') ? (base.split('.').pop() ?? '').toLowerCase() : ''
}

export async function browseFile(root: string, rel: string): Promise<FileBlob> {
  const file = safeJoin(root, rel)
  const info = await stat(file)
  const mime = IMAGE_MIME[extOf(rel)]

  // Images → return a data URL so the renderer shows the picture, not bytes.
  if (mime) {
    if (info.size > MAX_IMAGE_BYTES) {
      return { kind: 'image', content: '', dataUrl: null, truncated: true, size: info.size }
    }
    const buf = await readFile(file)
    return {
      kind: 'image',
      content: '',
      dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
      truncated: false,
      size: info.size
    }
  }

  if (info.size > MAX_BYTES) {
    return { kind: 'text', content: '', dataUrl: null, truncated: true, size: info.size }
  }
  const buf = await readFile(file)
  // Heuristic binary sniff: a NUL byte in the first 8 KB.
  if (buf.subarray(0, 8192).includes(0)) {
    return { kind: 'binary', content: '', dataUrl: null, truncated: false, size: info.size }
  }
  return {
    kind: 'text',
    content: buf.toString('utf8'),
    dataUrl: null,
    truncated: false,
    size: info.size
  }
}
