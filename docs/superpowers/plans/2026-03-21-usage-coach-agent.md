# Usage Coach Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live sidebar coach that watches active Claude Code sessions and surfaces workflow, prompt, and strategic tips in real-time.

**Architecture:** Three-layer pipeline — a session watcher (JSONL polling + CC process tap) feeds exchanges to an analyzer (Opus via llm-proxy), which emits tips to a sidebar UI via IPC. State persists to the JSON database for restart resilience.

**Tech Stack:** Electron 28, React 18, TypeScript, Zustand, Tailwind CSS, Node http (for llm-proxy calls)

**Spec:** `docs/superpowers/specs/2026-03-21-usage-coach-agent-design.md`

---

### Task 1: Shared Types + Database Schema

**Files:**
- Modify: `src/types/index.ts` (add CoachTip, CoachDbState, extend Memory sourceType)
- Modify: `electron/database.ts` (add coachState field + accessors)

- [ ] **Step 1: Add CoachTip and CoachDbState types to shared types**

In `src/types/index.ts`, add before the `ElectronAPI` interface:

```typescript
// === Usage Coach Types ===

export interface CoachTip {
  id: string
  category: 'workflow' | 'prompt' | 'strategic'
  severity: 'info' | 'suggestion' | 'warning'
  title: string
  body: string
  reference: string
  sessionId: string
  project: string
  timestamp: string
  dismissed: boolean
  saved: boolean
}

export interface CoachDbState {
  dayAccumulator: string
  lastResetDate: string
  enabled: boolean
  globalTipsEmitted: string[]
  sessions: Record<string, {
    byteOffset: number
    tipsEmitted: string[]
  }>
}
```

- [ ] **Step 2: Extend Memory sourceType union**

In `src/types/index.ts`, change the Memory interface `sourceType` line:

```typescript
// Before:
sourceType: 'chat' | 'cli_session' | 'journal' | 'task' | 'ai_task' | 'manual'
// After:
sourceType: 'chat' | 'cli_session' | 'journal' | 'task' | 'ai_task' | 'manual' | 'coach'
```

- [ ] **Step 3: Add ElectronAPI methods for coach**

In `src/types/index.ts`, add to the `ElectronAPI` interface:

```typescript
  // Usage Coach
  coachToggle: (enabled: boolean) => Promise<void>
  coachSaveTip: (tip: CoachTip) => Promise<void>
  coachClearDay: () => Promise<void>
  onCoachTips: (callback: (tips: CoachTip[]) => void) => () => void
  onCoachStatus: (callback: (data: { status: string; sessionCount: number }) => void) => () => void
  onCoachDaySummary: (callback: (summary: string) => void) => () => void
```

- [ ] **Step 4: Add coachState to the Database interface and add accessors**

In `electron/database.ts`:

**4a.** Import the `CoachDbState` type at the top of the file (after existing imports):

```typescript
import type { CoachDbState } from '../src/types'
```

**4b.** Add `coachState` to the `Database` interface (~line 662, before the closing `}`):

```typescript
  // Usage Coach
  coachState: CoachDbState
```

**4c.** In `initDatabase()`, add auto-migration after the existing migrations (after the `bankTransactions` dedup block, before `saveDatabase()`):

```typescript
    // Auto-migrate: coachState
    if (!db.coachState) {
      db.coachState = {
        dayAccumulator: '',
        lastResetDate: '',
        enabled: true,
        globalTipsEmitted: [],
        sessions: {},
      }
    }
```

Also add the same default in the `else` branch where a fresh `db` is created (~line 764):

```typescript
      coachState: {
        dayAccumulator: '',
        lastResetDate: '',
        enabled: true,
        globalTipsEmitted: [],
        sessions: {},
      },
```

**4d.** Add getter/setter functions near the bottom of the file (after `createMemory`):

```typescript
export function getCoachState(): CoachDbState {
  if (!db.coachState) {
    db.coachState = {
      dayAccumulator: '',
      lastResetDate: '',
      enabled: true,
      globalTipsEmitted: [],
      sessions: {},
    }
    saveDatabase()
  }
  return db.coachState
}

export function updateCoachState(updates: Partial<CoachDbState>): CoachDbState {
  const defaults: CoachDbState = {
    dayAccumulator: '',
    lastResetDate: '',
    enabled: true,
    globalTipsEmitted: [],
    sessions: {},
  }
  db.coachState = { ...(db.coachState || defaults), ...updates }
  saveDatabase()
  return db.coachState
}
```

The DB module uses a module-level `db` variable and `saveDatabase()` for writes. These accessors follow that pattern.

- [ ] **Step 5: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts electron/database.ts
git commit -m "feat(coach): add shared types and database schema for usage coach"
```

---

### Task 2: CC Stream Subscription Hook

**Files:**
- Modify: `electron/command-center.ts` (add EventEmitter + onStreamMessage export)

- [ ] **Step 1: Add EventEmitter and subscription function**

Near the top of `electron/command-center.ts`, after existing imports, add:

```typescript
import { EventEmitter } from 'events'
```

After the `let rendererReady = false` line (~line 79), add:

```typescript
const streamEmitter = new EventEmitter()

/** Subscribe to raw stream messages from all CC managed processes */
export function onStreamMessage(
  callback: (processId: string, msg: CCStreamMessage) => void
): () => void {
  const handler = (...args: any[]) => callback(args[0], args[1])
  streamEmitter.on('stream', handler)
  return () => { streamEmitter.off('stream', handler) }
}
```

- [ ] **Step 2: Emit stream events from handleMessage**

In the `handleMessage` function (~line 349), add at the very end of the function (after all existing processing, before the closing `}`):

```typescript
  // Emit for coach watcher
  const streamMsg: CCStreamMessage = { type: msg.type, timestamp }
  if (msg.type === 'assistant' && msg.message?.content) {
    for (const block of msg.message.content) {
      if (block.type === 'text') {
        streamEmitter.emit('stream', processId, { type: 'assistant', text: block.text?.slice(0, 2000), timestamp })
      } else if (block.type === 'tool_use') {
        streamEmitter.emit('stream', processId, { type: 'tool_use', toolName: block.name, timestamp })
      }
    }
  } else if (msg.type === 'result') {
    streamEmitter.emit('stream', processId, { type: 'result', timestamp })
  }
```

- [ ] **Step 3: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add electron/command-center.ts
git commit -m "feat(coach): expose onStreamMessage subscription from command-center"
```

---

### Task 3: Session Watcher

**Files:**
- Create: `electron/usage-coach/watcher.ts`

- [ ] **Step 1: Create the watcher module with all utilities**

Create `electron/usage-coach/watcher.ts`:

```typescript
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
```

- [ ] **Step 2: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add electron/usage-coach/watcher.ts
git commit -m "feat(coach): implement session watcher with JSONL polling and CC tap"
```

---

### Task 4: Coach Analyzer

**Files:**
- Create: `electron/usage-coach/analyzer.ts`

- [ ] **Step 1: Create the analyzer module with all logic**

Create `electron/usage-coach/analyzer.ts`:

```typescript
import http from 'http'
import crypto from 'crypto'
import { getCoachState, updateCoachState } from '../database'
import type { CoachTip, CoachDbState } from '../../src/types'
import type { CoachExchange } from './watcher'

// --- Proxy HTTP helpers ---

const PROXY_HOST = 'localhost'
const PROXY_PORT = 8741
const PROXY_PATH = '/claude/v1/chat/completions'
const MODEL = 'claude-opus-4-6'
const MAX_TOKENS = 1024
const TEMPERATURE = 0.3
const ANALYSIS_TIMEOUT = 15_000
const PING_TIMEOUT = 3_000
const PING_INTERVAL = 30_000
const MAX_QUEUE = 10
const MAX_ACCUMULATOR = 1000

function callProxy(
  messages: { role: string; content: string }[],
  timeoutMs: number = ANALYSIS_TIMEOUT
): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      messages,
    })

    const req = http.request(
      {
        hostname: PROXY_HOST,
        port: PROXY_PORT,
        path: PROXY_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`))
          }
        })
      }
    )

    const timer = setTimeout(() => {
      req.destroy(new Error('Analysis timeout'))
    }, timeoutMs)

    req.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    req.on('close', () => clearTimeout(timer))

    req.write(body)
    req.end()
  })
}

function pingProxy(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: PROXY_HOST,
        port: PROXY_PORT,
        path: '/',
        method: 'GET',
      },
      (res) => {
        res.resume() // drain
        resolve(res.statusCode !== undefined)
      }
    )
    const timer = setTimeout(() => {
      req.destroy()
      resolve(false)
    }, PING_TIMEOUT)
    req.on('error', () => { clearTimeout(timer); resolve(false) })
    req.on('close', () => clearTimeout(timer))
    req.end()
  })
}

// --- Deduplication ---

function hashTip(category: string, title: string, sessionId: string): string {
  return crypto
    .createHash('sha256')
    .update(category + title + sessionId)
    .digest('hex')
    .slice(0, 12)
}

// --- Prompt builder ---

const SYSTEM_PROMPT = `You are a usage coach analyzing a user's interaction with Claude Code (an AI coding assistant).

Analyze this exchange across three lenses. Only produce a tip when you have something concrete and actionable. Do not force tips — returning zero tips is valid.

WORKFLOW lens: Could the user have used a different tool, skill, or approach? Did they repeat a known mistake? Is manual work happening that could be automated?

PROMPT lens: Was the request clear enough for a good first attempt? Did ambiguity cause wasted turns? Could the user have provided more context upfront?

STRATEGIC lens: Cross-session patterns — project switching, time of day, recurring blockers, neglected projects, productivity trends.

Respond in JSON (no markdown fences):
{
  "tips": [
    {
      "category": "workflow" | "prompt" | "strategic",
      "severity": "info" | "suggestion" | "warning",
      "title": "short label (under 60 chars)",
      "body": "1-3 sentences of actionable advice",
      "reference": "quote the specific part of the exchange that triggered this"
    }
  ],
  "dayAccumulatorUpdate": "updated strategic summary incorporating this exchange (under 500 chars, or null if no change)"
}`

function buildPrompt(
  exchange: CoachExchange,
  recentExchanges: CoachExchange[],
  dayAccumulator: string
): { role: string; content: string }[] {
  let userContent = `CURRENT EXCHANGE (session: ${exchange.project}, turn ${exchange.turnIndex}):\n`
  userContent += `USER: ${exchange.userMessage}\n`
  userContent += `ASSISTANT: ${exchange.assistantMessage}\n`
  if (exchange.toolsUsed.length > 0) {
    userContent += `TOOLS USED: ${exchange.toolsUsed.join(', ')}\n`
  }

  if (recentExchanges.length > 0) {
    userContent += `\nRECENT CONTEXT (prior exchanges in this session):\n`
    for (const ex of recentExchanges) {
      userContent += `---\nTurn ${ex.turnIndex}:\n`
      userContent += `USER: ${ex.userMessage.slice(0, 500)}\n`
      userContent += `ASSISTANT: ${ex.assistantMessage.slice(0, 500)}\n`
      if (ex.toolsUsed.length > 0) {
        userContent += `TOOLS: ${ex.toolsUsed.join(', ')}\n`
      }
    }
  }

  if (dayAccumulator) {
    userContent += `\nTODAY'S PATTERNS (accumulated across sessions):\n${dayAccumulator}\n`
  }

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]
}

// --- Analyzer Class ---

export class CoachAnalyzer {
  status: 'active' | 'analyzing' | 'offline' | 'disabled' = 'disabled'
  onTips: ((tips: CoachTip[], daySummary: string) => void) | null = null
  onStatusChange: ((status: string, sessionCount: number) => void) | null = null

  private queue: CoachExchange[] = []
  private processing = false
  private dayAccumulator = ''
  private enabled = false
  private offlinePingTimer: ReturnType<typeof setInterval> | null = null
  private sessionCountFn: (() => number) | null = null

  /** Provide a function that returns the current watched session count */
  setSessionCountFn(fn: () => number) {
    this.sessionCountFn = fn
  }

  async start() {
    this.enabled = true
    const state = getCoachState()

    // Midnight rollover: reset if date changed
    const today = new Date().toISOString().split('T')[0]
    if (state.lastResetDate && state.lastResetDate !== today) {
      updateCoachState({
        dayAccumulator: '',
        globalTipsEmitted: [],
        lastResetDate: today,
      })
      this.dayAccumulator = ''
    } else {
      this.dayAccumulator = state.dayAccumulator || ''
      if (!state.lastResetDate) {
        updateCoachState({ lastResetDate: today })
      }
    }

    // Ping proxy to set initial status
    const alive = await pingProxy()
    this.setStatus(alive ? 'active' : 'offline')
    if (!alive) this.startOfflinePing()
  }

  stop() {
    this.enabled = false
    this.queue = []
    this.stopOfflinePing()

    // Persist accumulator
    updateCoachState({ dayAccumulator: this.dayAccumulator })
    this.setStatus('disabled')
  }

  enqueue(exchange: CoachExchange) {
    if (!this.enabled) return
    this.queue.push(exchange)
    // Cap queue: drop oldest if over limit
    if (this.queue.length > MAX_QUEUE) {
      this.queue = this.queue.slice(-MAX_QUEUE)
    }
    this.processNext()
  }

  private async processNext() {
    if (this.processing || !this.enabled || this.status === 'offline') return
    if (this.queue.length === 0) return

    const exchange = this.queue.shift()!
    this.processing = true
    this.setStatus('analyzing')

    try {
      // Build context: up to 4 prior exchanges from the watcher's session buffer
      // (passed via the exchange's sessionId — the orchestrator needs to supply recent exchanges)
      const messages = buildPrompt(exchange, [], this.dayAccumulator)
      const response = await callProxy(messages)

      // Check if disabled during the in-flight call
      if (!this.enabled) {
        this.processing = false
        return
      }

      // Parse response — OpenAI-compatible format from llm-proxy
      const content = response?.choices?.[0]?.message?.content || ''
      let parsed: any
      try {
        // Strip markdown fences if present
        const jsonStr = content.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
        parsed = JSON.parse(jsonStr)
      } catch {
        console.error('[coach-analyzer] Failed to parse LLM response:', content.slice(0, 200))
        this.processing = false
        this.setStatus('active')
        this.processNext()
        return
      }

      // Deduplicate tips
      const rawTips: any[] = parsed.tips || []
      const state = getCoachState()
      const sessionState = state.sessions[exchange.sessionId]
      const sessionHashes = new Set(sessionState?.tipsEmitted || [])
      const globalHashes = new Set(state.globalTipsEmitted || [])

      const newTips: CoachTip[] = []
      const newSessionHashes: string[] = []
      const newGlobalHashes: string[] = []

      for (const raw of rawTips) {
        if (!raw.category || !raw.title || !raw.body) continue

        const hash = hashTip(raw.category, raw.title, exchange.sessionId)

        // Session-level dedup
        if (sessionHashes.has(hash)) continue

        // Strategic tips also dedup across sessions for the day
        if (raw.category === 'strategic' && globalHashes.has(hash)) continue

        const tip: CoachTip = {
          id: crypto.randomUUID(),
          category: raw.category,
          severity: raw.severity || 'info',
          title: raw.title,
          body: raw.body,
          reference: raw.reference || '',
          sessionId: exchange.sessionId,
          project: exchange.project,
          timestamp: new Date().toISOString(),
          dismissed: false,
          saved: false,
        }
        newTips.push(tip)
        sessionHashes.add(hash)
        newSessionHashes.push(hash)

        if (raw.category === 'strategic') {
          globalHashes.add(hash)
          newGlobalHashes.push(hash)
        }
      }

      // Update day accumulator
      if (parsed.dayAccumulatorUpdate && parsed.dayAccumulatorUpdate !== 'null') {
        this.dayAccumulator = parsed.dayAccumulatorUpdate.slice(0, MAX_ACCUMULATOR)
      }

      // Persist updated hashes and accumulator
      const sessionsUpdate = { ...state.sessions }
      sessionsUpdate[exchange.sessionId] = {
        byteOffset: sessionsUpdate[exchange.sessionId]?.byteOffset || 0,
        tipsEmitted: [...(sessionsUpdate[exchange.sessionId]?.tipsEmitted || []), ...newSessionHashes],
      }
      updateCoachState({
        sessions: sessionsUpdate,
        globalTipsEmitted: [...(state.globalTipsEmitted || []), ...newGlobalHashes],
        dayAccumulator: this.dayAccumulator,
      })

      // Emit tips to UI
      if (newTips.length > 0) {
        this.onTips?.(newTips, this.dayAccumulator)
      }

      this.setStatus('active')
    } catch (err: any) {
      // Connection error: go offline
      if (
        err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET' ||
        err.message?.includes('timeout')
      ) {
        console.warn('[coach-analyzer] Proxy unreachable:', err.message)
        this.setStatus('offline')
        this.startOfflinePing()
      } else {
        console.error('[coach-analyzer] Analysis error:', err)
        this.setStatus('active')
      }
    }

    this.processing = false
    this.processNext()
  }

  private setStatus(status: 'active' | 'analyzing' | 'offline' | 'disabled') {
    this.status = status
    const count = this.sessionCountFn?.() || 0
    this.onStatusChange?.(status, count)
  }

  private startOfflinePing() {
    if (this.offlinePingTimer) return
    this.offlinePingTimer = setInterval(async () => {
      const alive = await pingProxy()
      if (alive) {
        this.stopOfflinePing()
        this.setStatus('active')
        // Process any queued exchanges
        this.processNext()
      }
    }, PING_INTERVAL)
  }

  private stopOfflinePing() {
    if (this.offlinePingTimer) {
      clearInterval(this.offlinePingTimer)
      this.offlinePingTimer = null
    }
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add electron/usage-coach/analyzer.ts
git commit -m "feat(coach): implement analyzer with proxy LLM calls and deduplication"
```

---

### Task 5: Coach Orchestrator + IPC

**Files:**
- Create: `electron/usage-coach/index.ts`
- Create: `electron/ipc/coach.ts`
- Modify: `electron/ipc/index.ts` (register coach handlers)
- Modify: `electron/preload.ts` (add coach IPC bridge)
- Modify: `electron/main.ts` (init/destroy coach)

- [ ] **Step 1: Create the orchestrator**

Create `electron/usage-coach/index.ts`:

```typescript
import { BrowserWindow } from 'electron'
import { SessionWatcher } from './watcher'
import { CoachAnalyzer } from './analyzer'
import { getCoachState, updateCoachState } from '../database'
import { createMemory } from '../database'
import type { CoachTip } from '../../src/types'

let watcher: SessionWatcher | null = null
let analyzer: CoachAnalyzer | null = null
let mainWindow: BrowserWindow | null = null
let currentTips: CoachTip[] = []

function safeSend(channel: string, ...args: any[]) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args)
    }
  } catch {}
}

export function initCoach(win: BrowserWindow) {
  mainWindow = win
  const state = getCoachState()

  analyzer = new CoachAnalyzer()
  analyzer.onTips = (tips, daySummary) => {
    currentTips = [...currentTips, ...tips]
    safeSend('coach:tips', currentTips)
    safeSend('coach:day-summary', daySummary)
  }
  analyzer.onStatusChange = (status, sessionCount) => {
    safeSend('coach:status', { status, sessionCount })
  }

  watcher = new SessionWatcher()
  watcher.onExchange = (exchange) => {
    analyzer?.enqueue(exchange)
  }

  // Let analyzer read the watcher's session count
  analyzer.setSessionCountFn(() => watcher?.sessions.size || 0)

  // Re-send tips on renderer reload
  win.webContents.on('did-finish-load', () => {
    safeSend('coach:tips', currentTips)
    safeSend('coach:status', {
      status: analyzer?.status || 'disabled',
      sessionCount: watcher?.sessions.size || 0,
    })
    const cs = getCoachState()
    safeSend('coach:day-summary', cs.dayAccumulator)
  })

  if (state.enabled) {
    watcher.start()
    analyzer.start()
  }
}

export function destroyCoach() {
  watcher?.stop()
  analyzer?.stop()
  watcher = null
  analyzer = null
}

export function toggleCoach(enabled: boolean) {
  updateCoachState({ enabled })
  if (enabled) {
    watcher?.start()
    analyzer?.start()
  } else {
    watcher?.stop()
    analyzer?.stop()
  }
}

export function saveTipToMemory(tip: CoachTip) {
  createMemory({
    title: `Coach: ${tip.title}`,
    content: `${tip.body}\n\nReference: ${tip.reference}`,
    topics: [tip.category, 'coach'],
    sourceType: 'coach',
    sourceId: tip.sessionId,
    sourcePreview: tip.reference.slice(0, 100),
    importance: tip.severity === 'warning' ? 3 : tip.severity === 'suggestion' ? 2 : 1,
    isPinned: false,
    isArchived: false,
    relatedMemoryIds: [],
  })
}

export function clearDay() {
  updateCoachState({
    dayAccumulator: '',
    globalTipsEmitted: [],
    lastResetDate: new Date().toISOString().split('T')[0],
  })
  currentTips = []
  safeSend('coach:tips', [])
  safeSend('coach:day-summary', '')
}

export function getCurrentTips(): CoachTip[] {
  return currentTips
}
```

- [ ] **Step 2: Create IPC handlers**

Create `electron/ipc/coach.ts`:

```typescript
import { ipcMain } from 'electron'
import { toggleCoach, saveTipToMemory, clearDay } from '../usage-coach'
import type { CoachTip } from '../../src/types'

export function registerCoachHandlers() {
  ipcMain.handle('coach:toggle', (_e, enabled: boolean) => {
    toggleCoach(enabled)
  })

  ipcMain.handle('coach:save-tip', (_e, tip: CoachTip) => {
    saveTipToMemory(tip)
  })

  ipcMain.handle('coach:clear-day', () => {
    clearDay()
  })
}
```

- [ ] **Step 3: Register coach handlers in barrel**

In `electron/ipc/index.ts`, add import and call:

```typescript
import { registerCoachHandlers } from './coach'

// Inside registerAllHandlers():
registerCoachHandlers()
```

- [ ] **Step 4: Add coach IPC bridge to preload**

In `electron/preload.ts`, add before the closing `})`:

```typescript
  // Usage Coach
  coachToggle: (enabled: boolean) => ipcRenderer.invoke('coach:toggle', enabled),
  coachSaveTip: (tip: any) => ipcRenderer.invoke('coach:save-tip', tip),
  coachClearDay: () => ipcRenderer.invoke('coach:clear-day'),
  onCoachTips: (callback: (tips: any[]) => void) => {
    const handler = (_: any, tips: any[]) => callback(tips)
    ipcRenderer.on('coach:tips', handler)
    return () => { ipcRenderer.removeListener('coach:tips', handler) }
  },
  onCoachStatus: (callback: (data: { status: string; sessionCount: number }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('coach:status', handler)
    return () => { ipcRenderer.removeListener('coach:status', handler) }
  },
  onCoachDaySummary: (callback: (summary: string) => void) => {
    const handler = (_: any, summary: string) => callback(summary)
    ipcRenderer.on('coach:day-summary', handler)
    return () => { ipcRenderer.removeListener('coach:day-summary', handler) }
  },
```

- [ ] **Step 5: Wire into main.ts**

In `electron/main.ts`, add import:

```typescript
import { initCoach, destroyCoach } from './usage-coach'
```

In the `app.whenReady()` block, after `registerAllHandlers(mainWindow!)` (~line 225), add:

```typescript
  // Initialize usage coach
  initCoach(mainWindow!)
```

In the `app.on('before-quit')` handler (~line 274), add before `shutdownAllProcesses()`:

```typescript
  destroyCoach()
```

- [ ] **Step 6: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add electron/usage-coach/index.ts electron/ipc/coach.ts electron/ipc/index.ts electron/preload.ts electron/main.ts
git commit -m "feat(coach): wire orchestrator, IPC handlers, preload bridge, and main init"
```

---

### Task 6: Zustand Store

**Files:**
- Create: `src/store/coachStore.ts`
- Modify: `src/store/index.ts` (add barrel export)

- [ ] **Step 1: Create the coach store**

Create `src/store/coachStore.ts`:

```typescript
import { create } from 'zustand'
import type { CoachTip } from '../types'

interface CoachStoreState {
  enabled: boolean
  status: 'active' | 'analyzing' | 'offline' | 'disabled'
  tips: CoachTip[]
  daySummary: string
  sessionCount: number
  panelOpen: boolean

  toggleEnabled: () => void
  togglePanel: () => void
  dismissTip: (id: string) => void
  saveTip: (id: string) => void
  clearDay: () => void
  setTips: (tips: CoachTip[]) => void
  setStatus: (status: CoachStoreState['status']) => void
  setSessionCount: (count: number) => void
  setDaySummary: (summary: string) => void
}

export const useCoachStore = create<CoachStoreState>((set, get) => ({
  enabled: true,
  status: 'active',
  tips: [],
  daySummary: '',
  sessionCount: 0,
  panelOpen: false,

  toggleEnabled: () => {
    const next = !get().enabled
    set({ enabled: next })
    window.electronAPI.coachToggle(next)
  },

  togglePanel: () => set(s => ({ panelOpen: !s.panelOpen })),

  dismissTip: (id) => set(s => ({
    tips: s.tips.map(t => t.id === id ? { ...t, dismissed: true } : t),
  })),

  saveTip: (id) => {
    const tip = get().tips.find(t => t.id === id)
    if (tip) {
      window.electronAPI.coachSaveTip(tip)
      set(s => ({
        tips: s.tips.map(t => t.id === id ? { ...t, saved: true } : t),
      }))
    }
  },

  clearDay: () => {
    window.electronAPI.coachClearDay()
    set({ tips: [], daySummary: '' })
  },

  setTips: (tips) => set({ tips }),
  setStatus: (status) => set({ status }),
  setSessionCount: (count) => set({ sessionCount: count }),
  setDaySummary: (summary) => set({ daySummary: summary }),
}))
```

- [ ] **Step 2: Add barrel export**

In `src/store/index.ts`, add:

```typescript
export { useCoachStore } from './coachStore'
```

- [ ] **Step 3: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/store/coachStore.ts src/store/index.ts
git commit -m "feat(coach): add Zustand store for coach UI state"
```

---

### Task 7: Coach UI Components

**Files:**
- Create: `src/components/coach/CoachStatusBadge.tsx`
- Create: `src/components/coach/CoachTipCard.tsx`
- Create: `src/components/coach/CoachDaySummary.tsx`
- Create: `src/components/coach/CoachPanel.tsx`
- Create: `src/components/coach/index.ts`

- [ ] **Step 1: Create CoachStatusBadge**

Create `src/components/coach/CoachStatusBadge.tsx`:

Small dot indicator. Green pulse = active, blue pulse = analyzing, gray = offline, hidden = disabled. Wrap in a button that toggles the panel open/closed.

```typescript
import { useCoachStore } from '../../store'

export default function CoachStatusBadge() {
  const { status, enabled, togglePanel, tips } = useCoachStore()
  if (!enabled) return null

  const activeTipCount = tips.filter(t => !t.dismissed).length
  const colors: Record<string, string> = {
    active: 'bg-emerald-400',
    analyzing: 'bg-blue-400 animate-pulse',
    offline: 'bg-zinc-500',
    disabled: 'bg-zinc-700',
  }

  return (
    <button
      onClick={togglePanel}
      className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors text-xs text-zinc-400"
      title={`Coach: ${status}`}
    >
      <span className={`w-2 h-2 rounded-full ${colors[status] || colors.offline}`} />
      <span>Coach</span>
      {activeTipCount > 0 && (
        <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
          {activeTipCount}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Create CoachTipCard**

Create `src/components/coach/CoachTipCard.tsx`:

Shows category badge, severity, title, body, reference quote. Actions: dismiss, save, copy.

```typescript
import { X, Bookmark, Copy, Info, Lightbulb, AlertTriangle } from 'lucide-react'
import type { CoachTip } from '../../types'
import { useCoachStore } from '../../store'

const CATEGORY_COLORS: Record<string, string> = {
  workflow: 'border-l-blue-500',
  prompt: 'border-l-purple-500',
  strategic: 'border-l-amber-500',
}

const CATEGORY_BADGE: Record<string, string> = {
  workflow: 'bg-blue-500/20 text-blue-400',
  prompt: 'bg-purple-500/20 text-purple-400',
  strategic: 'bg-amber-500/20 text-amber-400',
}

const SEVERITY_ICON: Record<string, typeof Info> = {
  info: Info,
  suggestion: Lightbulb,
  warning: AlertTriangle,
}

export default function CoachTipCard({ tip }: { tip: CoachTip }) {
  const { dismissTip, saveTip } = useCoachStore()
  const Icon = SEVERITY_ICON[tip.severity] || Info

  return (
    <div className={`bg-surface-2 rounded-lg border-l-2 ${CATEGORY_COLORS[tip.category]} p-3 space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-zinc-400 shrink-0" />
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[tip.category]}`}>
            {tip.category}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!tip.saved && (
            <button onClick={() => saveTip(tip.id)} className="p-1 hover:bg-white/5 rounded" title="Save to memories">
              <Bookmark size={12} className="text-zinc-500" />
            </button>
          )}
          <button
            onClick={() => navigator.clipboard.writeText(`${tip.title}\n${tip.body}`)}
            className="p-1 hover:bg-white/5 rounded" title="Copy"
          >
            <Copy size={12} className="text-zinc-500" />
          </button>
          <button onClick={() => dismissTip(tip.id)} className="p-1 hover:bg-white/5 rounded" title="Dismiss">
            <X size={12} className="text-zinc-500" />
          </button>
        </div>
      </div>
      <p className="text-sm font-medium text-zinc-200">{tip.title}</p>
      <p className="text-xs text-zinc-400 leading-relaxed">{tip.body}</p>
      {tip.reference && (
        <p className="text-[11px] text-zinc-500 italic border-l border-zinc-700 pl-2">
          {tip.reference}
        </p>
      )}
      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
        <span>{tip.project}</span>
        <span>{new Date(tip.timestamp).toLocaleTimeString()}</span>
        {tip.saved && <span className="text-emerald-500">Saved</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create CoachDaySummary**

Create `src/components/coach/CoachDaySummary.tsx`:

Collapsible section at the top of the panel. Shows day accumulator text, session count, tip count.

```typescript
import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { useCoachStore } from '../../store'

export default function CoachDaySummary() {
  const { daySummary, tips, sessionCount, clearDay } = useCoachStore()
  const [expanded, setExpanded] = useState(false)

  if (!daySummary) return null

  const activeTips = tips.filter(t => !t.dismissed).length

  return (
    <div className="bg-surface-2 rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="text-xs font-medium text-zinc-300">Day Summary</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span>{sessionCount} sessions</span>
          <span>{activeTips} tips</span>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-zinc-400 leading-relaxed">{daySummary}</p>
          <button
            onClick={clearDay}
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={10} /> Clear
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create CoachPanel**

Create `src/components/coach/CoachPanel.tsx`:

Sidebar container, 320px wide, slides from right. Houses the day summary + scrollable tip list.

```typescript
import { useEffect } from 'react'
import { useCoachStore } from '../../store'
import CoachTipCard from './CoachTipCard'
import CoachDaySummary from './CoachDaySummary'

export default function CoachPanel() {
  const { panelOpen, tips, setTips, setStatus, setSessionCount, setDaySummary } = useCoachStore()

  useEffect(() => {
    const unsubTips = window.electronAPI.onCoachTips((incoming) => {
      setTips(incoming)
    })
    const unsubStatus = window.electronAPI.onCoachStatus((data) => {
      setStatus(data.status as any)
      setSessionCount(data.sessionCount)
    })
    const unsubSummary = window.electronAPI.onCoachDaySummary((summary) => {
      setDaySummary(summary)
    })
    return () => { unsubTips(); unsubStatus(); unsubSummary() }
  }, [])

  const visibleTips = tips.filter(t => !t.dismissed)

  if (!panelOpen) return null

  return (
    <div className="w-80 shrink-0 border-l border-surface-3 bg-surface-1 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-surface-3">
        <h3 className="text-sm font-medium text-zinc-300">Usage Coach</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <CoachDaySummary />
        {visibleTips.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-8">
            Tips will appear here as you work
          </p>
        ) : (
          visibleTips.map(tip => <CoachTipCard key={tip.id} tip={tip} />)
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create barrel export**

Create `src/components/coach/index.ts`:

```typescript
export { default as CoachPanel } from './CoachPanel'
export { default as CoachStatusBadge } from './CoachStatusBadge'
export { default as CoachTipCard } from './CoachTipCard'
export { default as CoachDaySummary } from './CoachDaySummary'
```

- [ ] **Step 6: Run typecheck**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/components/coach/
git commit -m "feat(coach): add sidebar UI components — panel, tip cards, day summary, status badge"
```

---

### Task 8: Integrate Coach Panel into Command Center

**Files:**
- Modify: `src/components/command-center/CommandCenter.tsx` (add CoachPanel sidebar + CoachStatusBadge)

- [ ] **Step 1: Add CoachStatusBadge to the Command Center header**

In `CommandCenter.tsx`, import `CoachStatusBadge` and `CoachPanel`:

```typescript
import { CoachStatusBadge, CoachPanel } from '../coach'
import { useCoachStore } from '../../store'
```

Add `CoachStatusBadge` into the header/toolbar area of the Command Center (near the existing buttons like "New Task", pomodoro, etc.). Find the top bar area and add:

```tsx
<CoachStatusBadge />
```

- [ ] **Step 2: Add CoachPanel as a sidebar**

Wrap the existing Command Center content in a flex row. The layout should be:

```tsx
<div className="flex h-full">
  <div className="flex-1 overflow-hidden">
    {/* existing Command Center content */}
  </div>
  <CoachPanel />
</div>
```

The `CoachPanel` component already handles its own visibility via `panelOpen` state.

- [ ] **Step 3: Run typecheck and test visually**

Run: `cd "C:/Users/chris/chugnus-command-center" && npx tsc --noEmit`
Expected: 0 errors

Then run `npm run dev` and verify:
- Coach badge appears in the Command Center header
- Clicking the badge opens/closes the sidebar
- Sidebar is 320px wide, dark theme, slides from right

- [ ] **Step 4: Commit**

```bash
git add src/components/command-center/CommandCenter.tsx
git commit -m "feat(coach): integrate coach panel sidebar into Command Center tab"
```

---

### Task 9: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Verify proxy connectivity**

Ensure `llm-proxy` is running:

```bash
curl http://localhost:8741/
```

Expected: Some response (proxy is alive)

- [ ] **Step 2: Start the app and verify coach initializes**

Run: `cd "C:/Users/chris/chugnus-command-center" && npm run dev`

Check console for:
- No coach-related errors
- "Coach: active" or "Coach: offline" status depending on proxy

- [ ] **Step 3: Open an external Claude Code session**

In a separate terminal, start a Claude Code session in any project. Type a prompt. Wait 15 seconds.

Expected: A coaching tip appears in the Coach sidebar.

- [ ] **Step 4: Test CC process tap**

Launch a task from Command Center. The coach should pick up the CC process stream.

Expected: Tips appear for the CC-launched session.

- [ ] **Step 5: Test tip lifecycle**

- Dismiss a tip — it disappears from the list
- Save a tip — it shows "Saved" badge, appears in the Memories tab with `sourceType: 'coach'`
- Clear day — all tips removed, day summary cleared

- [ ] **Step 6: Test offline handling**

Stop `llm-proxy`. Coach status badge should turn gray within 30 seconds. Start proxy again. Status returns to green.

- [ ] **Step 7: Push**

```bash
git push
```
