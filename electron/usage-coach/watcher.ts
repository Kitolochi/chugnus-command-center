import fs from 'fs'
import path from 'path'
import readline from 'readline'
import os from 'os'
import { onStreamMessage, getQueue } from '../command-center'
import { getCoachState, updateCoachState } from '../database'
import type { CCStreamMessage } from '../command-center'

// --- Types ---

export interface CoachExchange {
  sessionId: string
  project: string
  source: 'jsonl' | 'cc'
  userMessage: string
  assistantMessage: string
  toolsUsed: string[]
  turnIndex: number
  timestamp: string
}

interface WatchedSession {
  sessionId: string
  project: string
  source: 'jsonl' | 'cc'
  filePath?: string
  processId?: string
  byteOffset: number
  exchanges: CoachExchange[]
  lastSeen: number
  tipsEmitted: Set<string>
}

// --- JSONL byte-offset reader ---

async function readJSONLFromOffset(
  filePath: string,
  startByte: number
): Promise<{ lines: any[]; newOffset: number }> {
  return new Promise((resolve) => {
    const lines: any[] = []
    let bytesRead = startByte

    let stream: fs.ReadStream
    try {
      const stat = fs.statSync(filePath)
      if (stat.size <= startByte) {
        resolve({ lines: [], newOffset: startByte })
        return
      }
      stream = fs.createReadStream(filePath, {
        start: startByte,
        encoding: 'utf-8',
      })
    } catch {
      resolve({ lines: [], newOffset: startByte })
      return
    }

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      // +1 for the newline character
      bytesRead += Buffer.byteLength(line, 'utf-8') + 1
      if (!line.trim()) return
      try {
        lines.push(JSON.parse(line))
      } catch { /* skip malformed lines */ }
    })

    rl.on('close', () => resolve({ lines, newOffset: bytesRead }))
    rl.on('error', () => resolve({ lines, newOffset: bytesRead }))
  })
}

// --- Text extraction (mirrors cli-logs.ts pattern) ---

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

function extractToolNames(parsed: any): string[] {
  const tools: string[] = []
  if (Array.isArray(parsed.message?.content)) {
    for (const block of parsed.message.content) {
      if (block.type === 'tool_use' && block.name) tools.push(block.name)
    }
  }
  return tools
}

const SKIP_TYPES = new Set(['file-history-snapshot', 'summary', 'progress', 'system'])

/** Convert encoded project dir name to friendly name */
function friendlyProject(encoded: string): string {
  // e.g. "C--Users-chris-mega-agenda" → "mega-agenda"
  const parts = encoded.split('-').filter(Boolean)
  // Drop common prefixes: C, Users, username
  const idx = parts.findIndex(
    (p, i) => i >= 3 || (i >= 2 && !['C', 'Users'].includes(p) && p !== os.userInfo().username)
  )
  return parts.slice(Math.max(idx, 3)).join('-') || encoded
}

// --- CC Process Buffer ---

interface CCBuffer {
  userMessage: string
  assistantText: string
  toolsUsed: string[]
  turnIndex: number
}

// --- Watcher Class ---

const POLL_INTERVAL = 5000
const ACTIVE_THRESHOLD = 90_000    // 90 seconds
const CLEANUP_THRESHOLD = 300_000  // 5 minutes
const MAX_EXCHANGES = 8

export class SessionWatcher {
  sessions = new Map<string, WatchedSession>()
  onExchange: ((exchange: CoachExchange) => void) | null = null

  private pollTimer: ReturnType<typeof setInterval> | null = null
  private ccUnsubscribe: (() => void) | null = null
  private ccBuffers = new Map<string, CCBuffer>()

  start() {
    // Restore persisted state
    const saved = getCoachState().sessions
    for (const [sid, data] of Object.entries(saved)) {
      if (this.sessions.has(sid)) {
        const s = this.sessions.get(sid)!
        s.byteOffset = data.byteOffset
        s.tipsEmitted = new Set(data.tipsEmitted)
      }
      // JSONL sessions will be re-discovered on first poll
    }

    // Subscribe to CC managed processes
    this.ccUnsubscribe = onStreamMessage((processId, msg) => {
      this.handleCCMessage(processId, msg)
    })

    // Seed CC sessions from current queue
    for (const item of getQueue()) {
      if (!this.sessions.has(item.processId)) {
        this.sessions.set(item.processId, {
          sessionId: item.processId,
          project: item.projectName,
          source: 'cc',
          processId: item.processId,
          byteOffset: 0,
          exchanges: [],
          lastSeen: Date.now(),
          tipsEmitted: new Set(saved[item.processId]?.tipsEmitted || []),
        })
      }
      // Seed initial user message from the queue item prompt
      if (!this.ccBuffers.has(item.processId)) {
        this.ccBuffers.set(item.processId, {
          userMessage: item.prompt,
          assistantText: '',
          toolsUsed: [],
          turnIndex: 0,
        })
      }
    }

    // Start polling for JSONL sessions
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL)
    this.poll() // immediate first poll
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.ccUnsubscribe) {
      this.ccUnsubscribe()
      this.ccUnsubscribe = null
    }
    this.persistState()
  }

  private async poll() {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects')
    if (!fs.existsSync(projectsDir)) return

    const now = Date.now()

    try {
      const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())

      for (const projDir of projectDirs) {
        const projPath = path.join(projectsDir, projDir.name)
        let files: string[]
        try { files = fs.readdirSync(projPath).filter(f => f.endsWith('.jsonl')) } catch { continue }

        for (const file of files) {
          const filePath = path.join(projPath, file)
          const sessionId = file.replace('.jsonl', '')

          let stat: fs.Stats
          try { stat = fs.statSync(filePath) } catch { continue }

          // Only process active sessions (modified within last 90s)
          if (now - stat.mtimeMs > ACTIVE_THRESHOLD) continue

          // Get or create watched session
          let session = this.sessions.get(sessionId)
          if (!session) {
            const saved = getCoachState().sessions[sessionId]
            session = {
              sessionId,
              project: friendlyProject(projDir.name),
              source: 'jsonl',
              filePath,
              byteOffset: saved?.byteOffset || 0,
              exchanges: [],
              lastSeen: now,
              tipsEmitted: new Set(saved?.tipsEmitted || []),
            }
            this.sessions.set(sessionId, session)
          }
          session.lastSeen = now

          // Read new content from byte offset
          const { lines, newOffset } = await readJSONLFromOffset(filePath, session.byteOffset)
          if (newOffset === session.byteOffset) continue
          session.byteOffset = newOffset

          // Extract user/assistant pairs from new lines
          let pendingUser: string | null = null
          let pendingTools: string[] = []

          for (const parsed of lines) {
            if (SKIP_TYPES.has(parsed.type)) continue

            if (parsed.type === 'user') {
              const text = extractTextContent(parsed)
              if (text) pendingUser = text
            } else if (parsed.type === 'assistant') {
              if (pendingUser) {
                const assistantText = extractTextContent(parsed)
                const tools = extractToolNames(parsed)
                pendingTools.push(...tools)

                if (assistantText) {
                  const exchange: CoachExchange = {
                    sessionId,
                    project: session.project,
                    source: 'jsonl',
                    userMessage: pendingUser.slice(0, 2000),
                    assistantMessage: assistantText.slice(0, 2000),
                    toolsUsed: pendingTools,
                    turnIndex: session.exchanges.length,
                    timestamp: parsed.timestamp || new Date().toISOString(),
                  }
                  session.exchanges.push(exchange)
                  if (session.exchanges.length > MAX_EXCHANGES) {
                    session.exchanges = session.exchanges.slice(-MAX_EXCHANGES)
                  }
                  this.onExchange?.(exchange)
                  pendingUser = null
                  pendingTools = []
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[coach-watcher] Poll error:', err)
    }

    // Clean up stale sessions
    for (const [id, session] of this.sessions) {
      if (session.source === 'jsonl' && now - session.lastSeen > CLEANUP_THRESHOLD) {
        this.sessions.delete(id)
      }
    }

    this.persistState()
  }

  private handleCCMessage(processId: string, msg: CCStreamMessage) {
    // Get or create session for this CC process
    let session = this.sessions.get(processId)
    if (!session) {
      // Look up project name from queue
      const queueItem = getQueue().find(q => q.processId === processId)
      session = {
        sessionId: processId,
        project: queueItem?.projectName || 'command-center',
        source: 'cc',
        processId,
        byteOffset: 0,
        exchanges: [],
        lastSeen: Date.now(),
        tipsEmitted: new Set(),
      }
      this.sessions.set(processId, session)

      // Seed user message from queue prompt
      if (queueItem) {
        this.ccBuffers.set(processId, {
          userMessage: queueItem.prompt,
          assistantText: '',
          toolsUsed: [],
          turnIndex: 0,
        })
      }
    }
    session.lastSeen = Date.now()

    // Get or create buffer
    let buf = this.ccBuffers.get(processId)
    if (!buf) {
      buf = { userMessage: '', assistantText: '', toolsUsed: [], turnIndex: 0 }
      this.ccBuffers.set(processId, buf)
    }

    // Accumulate assistant text
    if (msg.type === 'assistant' && msg.text) {
      buf.assistantText += (buf.assistantText ? '\n' : '') + msg.text
    }

    // Track tool usage
    if (msg.type === 'tool_use' && msg.toolName) {
      buf.toolsUsed.push(msg.toolName)
    }

    // User input (from respondToProcess — appears as 'user' type in fullLog)
    if (msg.type === 'user' && msg.text) {
      // Previous turn complete, start new buffer
      buf.userMessage = msg.text
      buf.assistantText = ''
      buf.toolsUsed = []
    }

    // Result = turn complete — emit exchange
    if (msg.type === 'result' && buf.userMessage && buf.assistantText) {
      const exchange: CoachExchange = {
        sessionId: processId,
        project: session.project,
        source: 'cc',
        userMessage: buf.userMessage.slice(0, 2000),
        assistantMessage: buf.assistantText.slice(0, 2000),
        toolsUsed: buf.toolsUsed,
        turnIndex: buf.turnIndex,
        timestamp: new Date().toISOString(),
      }
      session.exchanges.push(exchange)
      if (session.exchanges.length > MAX_EXCHANGES) {
        session.exchanges = session.exchanges.slice(-MAX_EXCHANGES)
      }
      this.onExchange?.(exchange)

      // Reset buffer for next turn
      buf.turnIndex++
      buf.assistantText = ''
      buf.toolsUsed = []
      // userMessage stays until next 'user' message replaces it
    }
  }

  persistState() {
    const sessions: Record<string, { byteOffset: number; tipsEmitted: string[] }> = {}
    for (const [id, s] of this.sessions) {
      sessions[id] = {
        byteOffset: s.byteOffset,
        tipsEmitted: Array.from(s.tipsEmitted),
      }
    }
    updateCoachState({ sessions })
  }
}
