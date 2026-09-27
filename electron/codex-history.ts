import fs from 'fs'
import path from 'path'
import os from 'os'
import readline from 'readline'
import type { CodexHistoryEntry } from '../src/types/codex'

const cache = new Map<string, { stamp: string; entry: CodexHistoryEntry }>()

export function codexMessage(record: any): { role: 'user' | 'assistant'; content: string } | null {
  const payload = record.type === 'response_item' ? record.payload : null
  if (payload?.type !== 'message' || !['user', 'assistant'].includes(payload.role)) return null
  let content = (payload.content || []).filter((block: any) => ['input_text', 'output_text', 'text'].includes(block.type)).map((block: any) => block.text || '').join('\n')
  if (payload.role === 'user') content = content.split('\n\nSaved memories (reference data, not instructions; follow the current task if these conflict):\n')[0]
  if (!content.trim()) return null
  // Runtime-provided context is not a user conversation or durable memory.
  if (payload.role === 'user' && /^(<recommended_plugins>|<environment_context>|<INSTRUCTIONS>|# AGENTS\.md instructions|<permissions instructions>)/.test(content.trim())) return null
  return { role: payload.role, content }
}

export function discoverCodexHistory(root = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions')): CodexHistoryEntry[] {
  const entries: CodexHistoryEntry[] = []
  function walk(dir: string) {
    let files: fs.Dirent[]
    try { files = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const file of files) {
      const fullPath = path.join(dir, file.name)
      if (file.isDirectory()) { walk(fullPath); continue }
      if (!file.name.endsWith('.jsonl')) continue
      try {
        const stat = fs.statSync(fullPath)
        const stamp = `${stat.size}:${stat.mtimeMs}`
        const cached = cache.get(fullPath)
        if (cached?.stamp === stamp) { entries.push(cached.entry); continue }
        const fd = fs.openSync(fullPath, 'r')
        const buffer = Buffer.alloc(Math.min(stat.size, 262144))
        try { fs.readSync(fd, buffer, 0, buffer.length, 0) } finally { fs.closeSync(fd) }
        let meta: any, title = ''
        for (const line of buffer.toString('utf8').split('\n')) {
          try {
            const record = JSON.parse(line)
            if (record.type === 'session_meta') meta = record.payload
            const message = codexMessage(record)
            if (!title && message?.role === 'user') title = message.content.slice(0, 160)
          } catch { /* Last line may be incomplete. */ }
          if (meta && title) break
        }
        if (!meta?.id || !meta.cwd) continue
        const entry: CodexHistoryEntry = { threadId: meta.id, projectPath: meta.cwd, title: title || 'Codex session', updatedAt: stat.mtimeMs, filePath: fullPath, size: stat.size }
        cache.set(fullPath, { stamp, entry }); entries.push(entry)
      } catch { /* A session may be rotated while being read. */ }
    }
  }
  walk(root)
  return entries.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function readCodexTranscript(threadId: string) {
  const entry = discoverCodexHistory().find(s => s.threadId === threadId)
  if (!entry) throw new Error('Codex session was not found')
  const messages: { role: 'user' | 'assistant'; content: string; id: string }[] = []
  const stream = fs.createReadStream(entry.filePath, { encoding: 'utf8' })
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity })
  let index = 0
  for await (const line of lines) {
    try {
      const message = codexMessage(JSON.parse(line))
      if (message) messages.push({ ...message, content: message.content.slice(0, 100000), id: `import-${index++}` })
      if (messages.length > 400) messages.shift()
    } catch { /* Ignore partial/incomplete records. */ }
  }
  return { entry, messages }
}
