import { spawn } from 'node:child_process'

export interface ExecResult {
  stdout: string
  stderr: string
  code: number
}

/**
 * Run a command without a shell (argv array — no injection surface).
 * Resolves even on non-zero exit; callers decide what to do with `code`.
 */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; input?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('error', (err) => reject(err))
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }))
    if (opts.input != null) {
      child.stdin.write(opts.input)
      child.stdin.end()
    }
  })
}

/** Run git in a repo; throws on failure with stderr as the message. */
export async function git(cwd: string, args: string[], input?: string): Promise<string> {
  const res = await run('git', args, { cwd, input })
  if (res.code !== 0) {
    throw new Error(res.stderr.trim() || `git ${args.join(' ')} failed (${res.code})`)
  }
  return res.stdout
}

/** Run gh (GitHub CLI). Throws on failure. */
export async function gh(args: string[], cwd?: string, input?: string): Promise<string> {
  const res = await run('gh', args, { cwd, input })
  if (res.code !== 0) {
    const msg = res.stderr.trim() || res.stdout.trim()
    throw new Error(msg || `gh ${args.join(' ')} failed (${res.code})`)
  }
  return res.stdout
}
