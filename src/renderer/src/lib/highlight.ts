import hljs from 'highlight.js/lib/common'

// Map file extensions / well-known filenames to highlight.js language ids.
const EXT_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  markdown: 'markdown',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  vue: 'xml',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  cfg: 'ini',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  diff: 'diff',
  patch: 'diff',
  lua: 'lua',
  r: 'r',
  pl: 'perl',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir'
}

const FILENAME_LANG: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  '.gitignore': 'bash',
  '.env': 'bash',
  '.bashrc': 'bash',
  '.zshrc': 'bash'
}

export function languageForPath(path: string): string | undefined {
  const base = path.split('/').pop()?.toLowerCase() ?? ''
  if (FILENAME_LANG[base]) return FILENAME_LANG[base]
  const ext = base.includes('.') ? base.split('.').pop() : undefined
  return ext ? EXT_LANG[ext] : undefined
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const AUTO_LIMIT = 300_000 // chars — skip auto-detection on very large files

/** Highlight a whole file to HTML (token <span>s). Falls back to escaped text. */
export function highlightCode(code: string, path: string): string {
  const lang = languageForPath(path)
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    }
    if (code.length <= AUTO_LIMIT) {
      return hljs.highlightAuto(code).value
    }
  } catch {
    /* fall through to plain */
  }
  return escapeHtml(code)
}

/** Highlight a single line of code (used by the diff viewer). */
export function highlightLine(content: string, lang: string | undefined): string {
  if (!content) return ''
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(content, { language: lang, ignoreIllegals: true }).value
    }
  } catch {
    /* fall through */
  }
  return escapeHtml(content)
}
