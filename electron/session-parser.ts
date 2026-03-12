import fs from 'fs'
import path from 'path'
import readline from 'readline'
import crypto from 'crypto'
import os from 'os'
import { Chunk } from './chunker'

export interface SessionMeta {
  path: string
  project: string
  sessionId: string
  size: number
  mtimeMs: number
}

const CHUNK_TARGET = 500
const MAX_ASSISTANT_LEN = 2000
const SKIP_TYPES = new Set(['file-history-snapshot', 'progress', 'summary', 'system'])

function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects')
}

/** Discover all JSONL session files across Claude Code projects */
export function discoverSessions(): SessionMeta[] {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return []

  const sessions: SessionMeta[] = []
  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const projPath = path.join(projectsDir, projDir.name)
      let files: string[]
      try { files = fs.readdirSync(projPath).filter(f => f.endsWith('.jsonl')) } catch { continue }

      for (const file of files) {
        const filePath = path.join(projPath, file)
        try {
          const stat = fs.statSync(filePath)
          sessions.push({
            path: filePath,
            project: projDir.name,
            sessionId: file.replace('.jsonl', ''),
            size: stat.size,
            mtimeMs: stat.mtimeMs,
          })
        } catch {}
      }
    }
  } catch {}

  return sessions
}

/** Fast change detection: MD5 for small files, size+mtime for large ones */
export function sessionFileHash(meta: SessionMeta): string {
  if (meta.size < 1_000_000) {
    try {
      const content = fs.readFileSync(meta.path)
      return crypto.createHash('md5').update(content).digest('hex')
    } catch {
      return `${meta.size}:${meta.mtimeMs}`
    }
  }
  return `${meta.size}:${meta.mtimeMs}`
}

/** Extract text content from a parsed JSONL message (matches cli-logs.ts pattern) */
function extractTextContent(parsed: any): string {
  if (typeof parsed.message?.content === 'string') return parsed.message.content
  if (Array.isArray(parsed.message?.content)) {
    return parsed.message.content
      .filter((b: any) => b.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n')
  }
  if (typeof parsed.content === 'string') return parsed.content
  if (Array.isArray(parsed.content)) {
    return parsed.content
      .filter((b: any) => b.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n')
  }
  return ''
}

/** Derive a friendly project name from the directory name (e.g. "C--Users-username-mega-agenda" → "mega-agenda") */
function friendlyProjectName(dirName: string): string {
  // Strip the common "C--Users-username-" prefix pattern
  const parts = dirName.split('-').filter(Boolean)
  // Take the last meaningful segments
  if (parts.length > 3) return parts.slice(-2).join('-')
  if (parts.length > 1) return parts[parts.length - 1]
  return dirName
}

/** Parse a single session file into Chunk[] */
export async function parseSession(meta: SessionMeta): Promise<Chunk[]> {
  return new Promise((resolve) => {
    const blocks: { role: 'user' | 'assistant'; text: string }[] = []
    let firstUserPrompt = ''

    const stream = fs.createReadStream(meta.path, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line)
        if (SKIP_TYPES.has(parsed.type)) return
        if (parsed.isMeta) return
        if (parsed.type !== 'user' && parsed.type !== 'assistant') return

        let text = extractTextContent(parsed)
        if (!text) return

        const role = parsed.type as 'user' | 'assistant'

        // Truncate assistant responses to avoid embedding noise from tool dumps
        if (role === 'assistant' && text.length > MAX_ASSISTANT_LEN) {
          text = text.slice(0, MAX_ASSISTANT_LEN)
        }

        if (!firstUserPrompt && role === 'user') {
          firstUserPrompt = text.slice(0, 80)
        }

        blocks.push({ role, text })
      } catch {}
    })

    rl.on('close', () => {
      if (blocks.length === 0) { resolve([]); return }

      const project = friendlyProjectName(meta.project)
      const domain = `sessions/${project}`
      const sourceFile = `sessions/${project}/${meta.sessionId}.jsonl`
      const heading = firstUserPrompt || meta.sessionId
      const hash = sessionFileHash(meta)

      // Merge consecutive same-role blocks, then chunk at ~CHUNK_TARGET chars
      const chunks: Chunk[] = []
      let buffer = ''
      let chunkIndex = 0

      for (const block of blocks) {
        const prefix = block.role === 'user' ? 'User: ' : 'Assistant: '
        const segment = prefix + block.text + '\n\n'

        buffer += segment

        while (buffer.length >= CHUNK_TARGET) {
          // Try to break at paragraph boundary
          const breakAt = buffer.indexOf('\n\n', CHUNK_TARGET / 2)
          const splitPoint = (breakAt > 0 && breakAt < CHUNK_TARGET * 1.5)
            ? breakAt + 2
            : CHUNK_TARGET

          const piece = buffer.slice(0, splitPoint).trim()
          if (piece.length >= 64) {
            chunks.push({
              text: piece,
              sourceFile,
              heading,
              domain,
              fileHash: hash,
              startLine: chunkIndex,
            })
          }
          buffer = buffer.slice(splitPoint)
          chunkIndex++
        }
      }

      // Flush remainder
      const remainder = buffer.trim()
      if (remainder.length >= 64) {
        chunks.push({
          text: remainder,
          sourceFile,
          heading,
          domain,
          fileHash: hash,
          startLine: chunkIndex,
        })
      }

      resolve(chunks)
    })

    rl.on('error', () => resolve([]))
  })
}
