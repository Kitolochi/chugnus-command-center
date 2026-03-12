import fs from 'fs'
import path from 'path'
import readline from 'readline'
import os from 'os'

interface CLISession {
  sessionId: string
  firstPrompt: string
  messageCount: number
  created: string
  modified: string
  project: string
}

interface CLISessionMessage {
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  model?: string
  uuid?: string
}

function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects')
}

/** Read the first heading/description from a project's CLAUDE.md */
export function getProjectDescription(projectPath: string): string {
  try {
    const claudeMd = path.join(projectPath, 'CLAUDE.md')
    if (!fs.existsSync(claudeMd)) return ''
    const content = fs.readFileSync(claudeMd, 'utf-8')
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
    // Skip the "# Title" line, grab the first non-heading descriptive line
    for (const line of lines) {
      if (line.startsWith('#')) continue
      if (line.startsWith('-') || line.startsWith('*')) continue
      if (line.length > 10) return line.slice(0, 200)
    }
  } catch {}
  return ''
}

/** Encode a filesystem path to Claude's project directory name format */
function pathToEncoded(p: string): string {
  return p.replace(':', '-').replace(/[\\/]/g, '-')
}

// Persistent cache: saved to disk so deep scan only happens once
const inferenceCache = new Map<string, string | null>()
let cacheLoaded = false

function getCachePath(): string {
  return path.join(os.homedir(), '.claude', 'projects', 'C--Users-chris', '.project-inference-cache.json')
}

function loadInferenceCache(): void {
  if (cacheLoaded) return
  cacheLoaded = true
  try {
    const cachePath = getCachePath()
    if (fs.existsSync(cachePath)) {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      for (const [k, v] of Object.entries(data)) {
        inferenceCache.set(k, v as string | null)
      }
    }
  } catch {}
}

function saveInferenceCache(): void {
  try {
    const obj: Record<string, string | null> = {}
    for (const [k, v] of inferenceCache.entries()) obj[k] = v
    fs.writeFileSync(getCachePath(), JSON.stringify(obj, null, 2))
  } catch {}
}

/** Infer the actual project from session JSONL content.
 *  Deep scans the full file on first encounter, caches result to disk.
 *  Subsequent loads hit the cache instantly. */
const knownDirsCache = new Map<string, boolean>()

async function inferProjectFromContent(filePath: string): Promise<string | null> {
  const sessionId = path.basename(filePath, '.jsonl')
  loadInferenceCache()
  if (inferenceCache.has(sessionId)) return inferenceCache.get(sessionId)!

  const homeDir = os.homedir()
  return new Promise((resolve) => {
    const projectRefs = new Map<string, number>()
    let linesRead = 0

    let stream: fs.ReadStream
    try {
      stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    } catch {
      inferenceCache.set(sessionId, null)
      resolve(null)
      return
    }
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    const addRef = (dir: string) => {
      // Filter out noise: must be a plausible project directory name
      if (!dir || dir.startsWith('.') || dir.length < 2) return
      // Skip common non-project directories
      if (['src', 'node_modules', 'electron', 'packages', 'apps', 'dist', 'build', 'lib', 'bin'].includes(dir)) return
      // Skip files (contain dots like .js, .ts, .md, .png, .csv, etc.)
      if (dir.includes('.')) return
      // Skip quoted/escaped artifacts
      if (dir.includes('"') || dir.includes("'")) return
      // Verify it's an actual directory on disk (cached)
      if (!knownDirsCache.has(dir)) {
        try {
          const fullPath = path.join(homeDir, dir)
          knownDirsCache.set(dir, fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory())
        } catch {
          knownDirsCache.set(dir, false)
        }
      }
      if (knownDirsCache.get(dir)) {
        projectRefs.set(dir, (projectRefs.get(dir) || 0) + 1)
      }
    }

    rl.on('line', (line) => {
      linesRead++
      try {
        const parsed = JSON.parse(line)

        // file-history-snapshot: extract top-level directories from tracked file paths
        if (parsed.type === 'file-history-snapshot' && parsed.snapshot?.trackedFileBackups) {
          for (const fp of Object.keys(parsed.snapshot.trackedFileBackups)) {
            const first = fp.split('\\')[0]
            addRef(first)
          }
        }

        // tool_use blocks: extract project from absolute paths
        if (parsed.type === 'assistant' && Array.isArray(parsed.message?.content)) {
          for (const block of parsed.message.content) {
            if (block.type === 'tool_use') {
              if (block.input?.file_path) {
                const match = block.input.file_path.match(/[Cc]:\\Users\\[^\\]+\\([^\\]+)/)
                if (match && match[1] !== '.claude') addRef(match[1])
              }
              if (block.input?.command) {
                const match = block.input.command.match(/[Cc]:\/Users\/[^/]+\/([^/\s"']+)/)
                if (match && match[1] !== '.claude') addRef(match[1])
              }
            }
          }
        }
      } catch {}
    })

    rl.on('close', () => {
      if (projectRefs.size === 0) {
        inferenceCache.set(sessionId, null)
        resolve(null)
        return
      }
      // Pick the most referenced project
      const sorted = [...projectRefs.entries()].sort((a, b) => b[1] - a[1])
      const result = sorted[0][0]
      inferenceCache.set(sessionId, result)
      resolve(result)
    })
    rl.on('error', () => {
      inferenceCache.set(sessionId, null)
      resolve(null)
    })
  })
}

export async function getCliSessions(): Promise<CLISession[]> {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return []

  const homeDir = os.homedir()
  const homeDirEncoded = pathToEncoded(homeDir)
  const sessions: CLISession[] = []

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const projPath = path.join(projectsDir, projDir.name)
      const isHomeBucket = projDir.name === homeDirEncoded

      // Load index as a cache, but always scan for JSONL files not in the index
      const indexPath = path.join(projPath, 'sessions-index.json')
      const indexedSessions = new Map<string, any>()
      if (fs.existsSync(indexPath)) {
        try {
          const indexRaw = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
          const entries = Array.isArray(indexRaw) ? indexRaw : indexRaw.entries
          if (Array.isArray(entries)) {
            for (const entry of entries) {
              const id = entry.sessionId || entry.id || ''
              if (id) indexedSessions.set(id, entry)
            }
          }
        } catch {}
      }

      const jsonlFiles = fs.readdirSync(projPath)
        .filter(f => f.endsWith('.jsonl'))

      for (const file of jsonlFiles) {
        const filePath = path.join(projPath, file)
        const sessionId = file.replace('.jsonl', '')

        // Use cached index entry if available (fast path)
        const cached = indexedSessions.get(sessionId)
        if (cached) {
          sessions.push({
            sessionId,
            firstPrompt: cached.summary || cached.firstPrompt || '',
            messageCount: cached.messageCount || 0,
            created: cached.created || cached.createdAt || '',
            modified: cached.modified || cached.updatedAt || '',
            project: projDir.name
          })
          continue
        }

        // Full scan for sessions not in the index
        try {
          const stat = fs.statSync(filePath)
          // Quick size check — skip tiny files (< 100 bytes are empty sessions)
          if (stat.size < 100) continue

          const { prompt: firstPrompt, hasRealContent } = await getFirstPrompt(filePath)

          // Skip empty sessions (opened Claude Code but never typed a real prompt)
          if (!hasRealContent && !firstPrompt) continue

          let project = projDir.name
          // For sessions in the home directory bucket, try to infer the actual project
          if (isHomeBucket) {
            const inferred = await inferProjectFromContent(filePath)
            if (inferred) {
              project = pathToEncoded(path.join(homeDir, inferred))
            }
          }

          sessions.push({
            sessionId,
            firstPrompt,
            messageCount: Math.max(1, Math.round(stat.size / 500)),
            created: stat.birthtime.toISOString(),
            modified: stat.mtime.toISOString(),
            project
          })
        } catch {}
      }
    }
  } catch {}

  // Persist inference cache to disk after processing all sessions
  saveInferenceCache()

  return sessions.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
}

/** Skip generic startup messages that aren't real user prompts */
const SKIP_PROMPTS = new Set(['read', 'continue', ''])

async function getFirstPrompt(filePath: string): Promise<{ prompt: string; hasRealContent: boolean }> {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
    let found = false
    let userMsgCount = 0

    rl.on('line', (line) => {
      if (found) return
      try {
        const parsed = JSON.parse(line)
        if (parsed.type === 'user') {
          const content = extractTextContent(parsed)
          userMsgCount++
          // Skip "Read", "continue", and other generic startup messages
          if (content && !SKIP_PROMPTS.has(content.trim().toLowerCase()) && content.length > 5) {
            found = true
            resolve({ prompt: content.slice(0, 150), hasRealContent: true })
            rl.close()
            stream.destroy()
          }
        }
      } catch {}
    })

    rl.on('close', () => {
      if (!found) resolve({ prompt: '', hasRealContent: userMsgCount >= 1 })
    })

    rl.on('error', () => resolve({ prompt: '', hasRealContent: false }))
  })
}

async function countLines(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    let count = 0
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', () => { count++ })
    rl.on('close', () => resolve(count))
    rl.on('error', () => resolve(0))
  })
}

function isDisplayableMessage(parsed: any): boolean {
  // Skip non-message types
  if (['file-history-snapshot', 'summary', 'progress', 'system'].includes(parsed.type)) return false
  // Skip meta messages
  if (parsed.isMeta) return false
  // Only user and assistant
  return parsed.type === 'user' || parsed.type === 'assistant'
}

function extractTextContent(parsed: any): string {
  // Claude Code JSONL format: message.content can be string or array of content blocks
  if (typeof parsed.message?.content === 'string') {
    return parsed.message.content
  }
  if (Array.isArray(parsed.message?.content)) {
    // Filter out thinking blocks, tool_use blocks, file-history-snapshot — keep only text
    return parsed.message.content
      .filter((b: any) => b.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n')
  }
  // Alternative format (some entries use top-level content)
  if (typeof parsed.content === 'string') {
    return parsed.content
  }
  if (Array.isArray(parsed.content)) {
    return parsed.content
      .filter((b: any) => b.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n')
  }
  return ''
}

export async function getCliSessionMessages(
  sessionId: string,
  offset: number = 0,
  limit: number = 50
): Promise<{ messages: CLISessionMessage[]; hasMore: boolean }> {
  const filePath = await findSessionFile(sessionId)
  if (!filePath) return { messages: [], hasMore: false }

  return new Promise((resolve) => {
    const messages: CLISessionMessage[] = []
    let lineIndex = 0
    let collected = 0

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line)

        if (!isDisplayableMessage(parsed)) return

        const type: 'user' | 'assistant' = parsed.type === 'user' ? 'user' : 'assistant'
        const content = extractTextContent(parsed)
        if (!content) return

        if (lineIndex >= offset && collected < limit) {
          messages.push({
            type,
            content: content.slice(0, 5000),
            timestamp: parsed.timestamp || '',
            model: parsed.message?.model || undefined,
            uuid: parsed.uuid || undefined
          })
          collected++
        }

        lineIndex++
      } catch {}
    })

    rl.on('close', () => {
      resolve({
        messages,
        hasMore: lineIndex > offset + limit
      })
    })

    rl.on('error', () => {
      resolve({ messages: [], hasMore: false })
    })
  })
}

async function findSessionFile(sessionId: string): Promise<string | null> {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return null

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const filePath = path.join(projectsDir, projDir.name, `${sessionId}.jsonl`)
      if (fs.existsSync(filePath)) return filePath
    }
  } catch {}

  return null
}

export async function searchCliSessions(
  query: string
): Promise<{ sessionId: string; firstPrompt: string; matches: string[]; project: string }[]> {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return []

  const results: { sessionId: string; firstPrompt: string; matches: string[]; project: string }[] = []
  const lowerQuery = query.toLowerCase()

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const projPath = path.join(projectsDir, projDir.name)
      const jsonlFiles = fs.readdirSync(projPath).filter(f => f.endsWith('.jsonl'))

      for (const file of jsonlFiles) {
        const filePath = path.join(projPath, file)
        const sessionId = file.replace('.jsonl', '')

        const sessionResult = await searchInSession(filePath, sessionId, lowerQuery, projDir.name)
        if (sessionResult) {
          results.push(sessionResult)
        }

        if (results.length >= 20) break
      }
      if (results.length >= 20) break
    }
  } catch {}

  return results
}

export async function findSessionByPromptFragment(
  fragment: string,
  afterTimestamp?: string
): Promise<string | null> {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return null
  const lowerFragment = fragment.toLowerCase()

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const projPath = path.join(projectsDir, projDir.name)
      const jsonlFiles = fs.readdirSync(projPath).filter(f => f.endsWith('.jsonl'))

      for (const file of jsonlFiles) {
        const filePath = path.join(projPath, file)
        const sessionId = file.replace('.jsonl', '')

        // Filter by creation time if afterTimestamp provided
        if (afterTimestamp) {
          try {
            const stat = fs.statSync(filePath)
            if (stat.birthtime.toISOString() < afterTimestamp) continue
          } catch { continue }
        }

        const firstPrompt = await getFirstPrompt(filePath)
        if (firstPrompt.toLowerCase().includes(lowerFragment)) {
          return sessionId
        }
      }
    }
  } catch {}

  return null
}

// --- Session utilities for agent auto-completion ---

export interface SessionResult {
  summary: string
  totalInputTokens: number
  totalOutputTokens: number
  model: string
  toolCalls?: { tool: string; count: number }[]
  filesChanged?: string[]
  gitCommits?: string[]
}

/** Find the JSONL file path for a given session ID */
export function getSessionFilePath(sessionId: string): string | null {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return null

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const filePath = path.join(projectsDir, projDir.name, `${sessionId}.jsonl`)
      if (fs.existsSync(filePath)) return filePath
    }
  } catch {}

  return null
}

/** Check if a session file is complete (no writes in the last 90 seconds) */
export function isSessionComplete(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath)
    return Date.now() - stat.mtimeMs > 90_000
  } catch {
    return false
  }
}

/** Extract token usage, summary, tool calls, files changed, and git commits from a completed session JSONL */
export async function extractSessionResult(filePath: string): Promise<SessionResult> {
  return new Promise((resolve) => {
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let model = ''
    let lastTextContent = ''
    const toolCounts = new Map<string, number>()
    const filesChanged = new Set<string>()
    const gitCommits: string[] = []

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line)

        // Track file-history-snapshot entries for files changed
        if (parsed.type === 'file-history-snapshot' && parsed.filePath) {
          filesChanged.add(parsed.filePath)
        }

        if (parsed.type === 'assistant') {
          if (parsed.message?.usage) {
            totalInputTokens += parsed.message.usage.input_tokens || 0
            totalOutputTokens += parsed.message.usage.output_tokens || 0
          }
          if (parsed.message?.model) {
            model = parsed.message.model
          }
          const text = extractTextContent(parsed)
          if (text) lastTextContent = text

          // Parse tool_use blocks for tool counts and file/commit tracking
          if (Array.isArray(parsed.message?.content)) {
            for (const block of parsed.message.content) {
              if (block.type === 'tool_use' && block.name) {
                toolCounts.set(block.name, (toolCounts.get(block.name) || 0) + 1)
                // Track file paths from Write/Edit tool inputs
                if ((block.name === 'Write' || block.name === 'Edit') && block.input?.file_path) {
                  filesChanged.add(block.input.file_path)
                }
                // Detect git commit messages from Bash tool inputs
                if (block.name === 'Bash' && typeof block.input?.command === 'string') {
                  const commitMatch = block.input.command.match(/git commit\s+-m\s+["']([^"']+)["']/)
                  if (commitMatch) gitCommits.push(commitMatch[1])
                }
              }
            }
          }
        }
      } catch {}
    })

    rl.on('close', () => {
      const toolCallsArr = Array.from(toolCounts.entries()).map(([tool, count]) => ({ tool, count }))
      resolve({
        summary: lastTextContent.slice(0, 2000),
        totalInputTokens,
        totalOutputTokens,
        model,
        toolCalls: toolCallsArr.length > 0 ? toolCallsArr : undefined,
        filesChanged: filesChanged.size > 0 ? Array.from(filesChanged) : undefined,
        gitCommits: gitCommits.length > 0 ? gitCommits : undefined,
      })
    })

    rl.on('error', () => {
      resolve({ summary: '', totalInputTokens: 0, totalOutputTokens: 0, model: '' })
    })
  })
}

async function searchInSession(
  filePath: string,
  sessionId: string,
  lowerQuery: string,
  project: string = ''
): Promise<{ sessionId: string; firstPrompt: string; matches: string[]; project: string } | null> {
  return new Promise((resolve) => {
    const matches: string[] = []
    let firstPrompt = ''

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line)
        if (!isDisplayableMessage(parsed)) return

        const content = extractTextContent(parsed)
        if (!content) return

        if (!firstPrompt && parsed.type === 'user') {
          firstPrompt = content.slice(0, 100)
        }

        if (content.toLowerCase().includes(lowerQuery)) {
          // Extract a snippet around the match
          const idx = content.toLowerCase().indexOf(lowerQuery)
          const start = Math.max(0, idx - 40)
          const end = Math.min(content.length, idx + lowerQuery.length + 40)
          matches.push(content.slice(start, end))
        }
      } catch {}
    })

    rl.on('close', () => {
      if (matches.length > 0) {
        resolve({ sessionId, firstPrompt, matches: matches.slice(0, 5), project })
      } else {
        resolve(null)
      }
    })

    rl.on('error', () => resolve(null))
  })
}
