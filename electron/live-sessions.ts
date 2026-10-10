import fs from 'fs'
import os from 'os'
import path from 'path'
import type { LiveMessage, LiveSession } from '../src/types/live'

// Every interactive Claude Code process writes ~/.claude/sessions/<pid>.json (session id, cwd, busy/idle status)
// and appends its conversation to ~/.claude/projects/<encoded cwd>/<session id>.jsonl. Session files reach
// hundreds of MB, so only their tail is read, and parses are cached on size + mtime.

const LIST_TAIL_BYTES = 512 * 1024
const MESSAGES_TAIL_BYTES = 2 * 1024 * 1024
const MAX_TEXT = 4000
const MAX_MESSAGES = 40

interface TailSummary {
  title?: string
  lastPrompt?: string
  messages: LiveMessage[]
}

const tailCache = new Map<string, { stamp: string; summary: TailSummary }>()
const fileCache = new Map<string, string>()

function shortInput(input: any): string {
  if (!input || typeof input !== 'object') return ''
  const value =
    input.description || input.command || input.file_path || input.pattern || input.url || input.query || input.skill
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').slice(0, 160) : ''
}

/** Turn the tail of a session JSONL into its title, the last prompt and the messages a person would see. */
export function parseSessionTail(text: string): TailSummary {
  let customTitle: string | undefined
  let aiTitle: string | undefined
  let lastPrompt: string | undefined
  const messages: LiveMessage[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let record: any
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }
    if (record.type === 'custom-title' && record.customTitle) customTitle = record.customTitle
    else if (record.type === 'ai-title' && record.aiTitle) aiTitle = record.aiTitle
    else if (record.type === 'last-prompt' && record.lastPrompt) lastPrompt = record.lastPrompt
    if ((record.type !== 'user' && record.type !== 'assistant') || record.isSidechain || record.isMeta) continue
    const content = record.message?.content
    const timestamp = record.timestamp
    if (record.isCompactSummary) {
      messages.push({ role: 'tool', text: 'Earlier messages were summarized', timestamp })
      continue
    }
    if (record.type === 'user') {
      const typed =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content
                .filter((block: any) => block.type === 'text')
                .map((block: any) => block.text || '')
                .join('\n')
            : ''
      // Tool results carry no text blocks; runtime wrappers (<command-name>, <local-command-stdout>) start with '<'.
      if (typed.trim() && !typed.trimStart().startsWith('<'))
        messages.push({ role: 'user', text: typed.slice(0, MAX_TEXT), timestamp })
      continue
    }
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block.type === 'text' && block.text?.trim()) {
        messages.push({ role: 'assistant', text: block.text.slice(0, MAX_TEXT), timestamp })
      } else if (block.type === 'tool_use') {
        const detail = shortInput(block.input)
        messages.push({ role: 'tool', text: detail ? `${block.name}: ${detail}` : block.name, timestamp })
      }
    }
  }
  return { title: customTitle || aiTitle, lastPrompt, messages }
}

function readTail(file: string, size: number, bytes: number): string {
  const length = Math.min(size, bytes)
  const buffer = Buffer.alloc(length)
  const fd = fs.openSync(file, 'r')
  try {
    fs.readSync(fd, buffer, 0, length, size - length)
  } finally {
    fs.closeSync(fd)
  }
  const text = buffer.toString('utf8')
  // A read that starts mid-file starts mid-line: drop that partial first line.
  return length < size ? text.slice(text.indexOf('\n') + 1) : text
}

function summarize(file: string, bytes: number): { summary: TailSummary; mtimeMs: number } | null {
  let stat: fs.Stats
  try {
    stat = fs.statSync(file)
  } catch {
    return null
  }
  const key = `${file}:${bytes}`
  const stamp = `${stat.size}:${stat.mtimeMs}`
  const cached = tailCache.get(key)
  if (cached?.stamp === stamp) return { summary: cached.summary, mtimeMs: stat.mtimeMs }
  const summary = parseSessionTail(readTail(file, stat.size, bytes))
  tailCache.set(key, { stamp, summary })
  return { summary, mtimeMs: stat.mtimeMs }
}

export function findSessionFile(sessionId: string, cwd: string, projectsDir: string): string | null {
  const cached = fileCache.get(sessionId)
  if (cached && fs.existsSync(cached)) return cached
  const fileName = `${sessionId}.jsonl`
  let found: string | null = null
  const direct = path.join(projectsDir, cwd.replace(/[^a-zA-Z0-9]/g, '-'), fileName)
  if (fs.existsSync(direct)) found = direct
  else {
    try {
      for (const dir of fs.readdirSync(projectsDir)) {
        const candidate = path.join(projectsDir, dir, fileName)
        if (fs.existsSync(candidate)) {
          found = candidate
          break
        }
      }
    } catch {
      /* no projects dir yet */
    }
  }
  if (found) fileCache.set(sessionId, found)
  return found
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err: any) {
    return err.code === 'EPERM'
  }
}

/** Claude Code sessions whose process is still running, newest activity first. */
export function listLiveSessions(opts: { claudeDir?: string; exclude?: Set<string> } = {}): LiveSession[] {
  const claudeDir = opts.claudeDir || path.join(os.homedir(), '.claude')
  const registryDir = path.join(claudeDir, 'sessions')
  let names: string[]
  try {
    names = fs.readdirSync(registryDir).filter((name) => name.endsWith('.json'))
  } catch {
    return []
  }
  const sessions: LiveSession[] = []
  for (const name of names) {
    let entry: any
    try {
      entry = JSON.parse(fs.readFileSync(path.join(registryDir, name), 'utf8'))
    } catch {
      continue
    }
    if (!entry?.pid || !entry.sessionId || opts.exclude?.has(entry.sessionId) || !isAlive(entry.pid)) continue
    const cwd = entry.cwd || ''
    const file = findSessionFile(entry.sessionId, cwd, path.join(claudeDir, 'projects'))
    const tail = file ? summarize(file, LIST_TAIL_BYTES) : null
    const messages = tail?.summary.messages || []
    const last = messages[messages.length - 1]
    const lastLine = last?.text.split('\n')[0].slice(0, 200)
    sessions.push({
      pid: entry.pid,
      sessionId: entry.sessionId,
      name: entry.name || `pid ${entry.pid}`,
      title: tail?.summary.title || tail?.summary.lastPrompt || entry.name || 'Untitled session',
      cwd,
      projectName: path.basename(cwd) || cwd,
      status: entry.status || 'unknown',
      kind: entry.kind || 'interactive',
      startedAt: entry.startedAt || 0,
      updatedAt: Math.max(entry.statusUpdatedAt || entry.updatedAt || 0, tail?.mtimeMs || 0),
      lastPrompt: tail?.summary.lastPrompt,
      latestActivity: last ? (last.role === 'user' ? `You: ${lastLine}` : lastLine) : undefined,
    })
  }
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getLiveMessages(opts: { sessionId: string; cwd: string; claudeDir?: string }): LiveMessage[] {
  const claudeDir = opts.claudeDir || path.join(os.homedir(), '.claude')
  const file = findSessionFile(opts.sessionId, opts.cwd, path.join(claudeDir, 'projects'))
  const tail = file ? summarize(file, MESSAGES_TAIL_BYTES) : null
  return tail ? tail.summary.messages.slice(-MAX_MESSAGES) : []
}
