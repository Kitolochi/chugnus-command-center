import http from 'http'
import crypto from 'crypto'
import { BrowserWindow } from 'electron'

// === Types (mirroring src/types for main process) ===

type CollabAgent = 'claude' | 'gpt'

interface CollabMessage {
  role: 'user' | 'assistant'
  content: string
}

interface CollabTurn {
  id: string
  agent: CollabAgent
  content: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  durationMs: number
  timestamp: number
}

interface CollabSession {
  id: string
  task: string
  status: 'running' | 'awaiting_input' | 'completed' | 'killed' | 'errored'
  turns: CollabTurn[]
  conversationHistory: CollabMessage[]
  totalCostUsd: number
  roundCount: number
  inputQuestion?: string
  summary?: string
  errorMessage?: string
  parentSessionId?: string
  startedAt: number
  updatedAt: number
  completedAt?: number
}

// === Config ===

const PROXY_BASE = 'http://127.0.0.1:8741'
const CLAUDE_ENDPOINT = '/claude/v1/chat/completions'
const GPT_ENDPOINT = '/codex/v1/chat/completions'
const CLAUDE_MODEL = 'claude-opus-4-6'
const GPT_MODEL = 'gpt-5.4'
const MAX_TOKENS = 4096
const NEED_INPUT_TAG = 'NEED_USER_INPUT:'

// Cost per 1M tokens (USD)
const COST_CLAUDE_IN = 15
const COST_CLAUDE_OUT = 75
const COST_GPT_IN = 5
const COST_GPT_OUT = 15

const CLAUDE_SYSTEM = `You are Claude (Opus 4.6), an expert coding agent. You are collaborating with GPT-5.4 on a coding task given by the user.

Rules:
- Focus on writing correct, clean, production-quality code
- When the other agent proposes something, review it critically — agree, extend, or push back
- Be direct and concise. Skip pleasantries.
- If you genuinely need clarification or a decision from the USER (not from GPT), write exactly: ${NEED_INPUT_TAG} <your question>
- Do NOT use ${NEED_INPUT_TAG} for questions GPT can answer — only for things requiring human judgment (architecture decisions, credentials, preferences, ambiguous requirements)
- When the task feels complete, say TASK_COMPLETE and summarize what was built
- You can see GPT's previous messages. Build on them, don't repeat work.`

const GPT_SYSTEM = `You are GPT-5.4, an expert coding agent. You are collaborating with Claude Opus 4.6 on a coding task given by the user.

Rules:
- Focus on writing correct, clean, production-quality code
- When Claude proposes something, review it critically — agree, extend, or push back
- Be direct and concise. Skip pleasantries.
- If you genuinely need clarification or a decision from the USER (not from Claude), write exactly: ${NEED_INPUT_TAG} <your question>
- Do NOT use ${NEED_INPUT_TAG} for questions Claude can answer — only for things requiring human judgment (architecture decisions, credentials, preferences, ambiguous requirements)
- When the task feels complete, say TASK_COMPLETE and summarize what was built
- You can see Claude's previous messages. Build on them, don't repeat work.`

// === State ===

let mainWindow: BrowserWindow | null = null
let activeSession: CollabSession | null = null
let abortController: AbortController | null = null
let inputResolve: ((value: string) => void) | null = null
let onSessionComplete: ((session: CollabSession) => void) | null = null
let getHistoryEntry: ((id: string) => CollabSession | undefined) | null = null

// === Public API ===

export function initDualAgent(win: BrowserWindow) {
  mainWindow = win
}

export function setOnSessionComplete(cb: (session: CollabSession) => void) {
  onSessionComplete = cb
}

export function setGetHistoryEntry(cb: (id: string) => CollabSession | undefined) {
  getHistoryEntry = cb
}

export function getActiveCollabSession(): CollabSession | null {
  if (!activeSession) return null
  return snapshot(activeSession)
}

export function startCollabSession(task: string, maxRounds = 4): { sessionId: string } {
  if (activeSession && (activeSession.status === 'running' || activeSession.status === 'awaiting_input')) {
    throw new Error('A collab session is already running')
  }

  const session: CollabSession = {
    id: crypto.randomUUID(),
    task,
    status: 'running',
    turns: [],
    conversationHistory: [{ role: 'user', content: task }],
    totalCostUsd: 0,
    roundCount: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  }

  launchSession(session, maxRounds)
  return { sessionId: session.id }
}

export function resumeCollabSession(parentSessionId: string, maxRounds = 4): { sessionId: string } {
  if (activeSession && (activeSession.status === 'running' || activeSession.status === 'awaiting_input')) {
    throw new Error('A collab session is already running')
  }

  if (!getHistoryEntry) throw new Error('History lookup not configured')
  const parent = getHistoryEntry(parentSessionId)
  if (!parent) throw new Error(`Session ${parentSessionId} not found in history`)

  const session: CollabSession = {
    id: crypto.randomUUID(),
    task: parent.task,
    status: 'running',
    turns: [...parent.turns],
    conversationHistory: [...parent.conversationHistory],
    totalCostUsd: parent.totalCostUsd,
    roundCount: 0,
    parentSessionId,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Inject a resume message so the agents know context was restored
  session.conversationHistory.push({
    role: 'user',
    content: '[Session resumed by user. Continue where you left off.]',
  })

  launchSession(session, maxRounds)
  return { sessionId: session.id }
}

export function respondToCollab(sessionId: string, response: string): void {
  if (!activeSession || activeSession.id !== sessionId) {
    throw new Error('No matching active session')
  }
  if (activeSession.status !== 'awaiting_input') {
    throw new Error('Session is not awaiting input')
  }
  if (!inputResolve) {
    throw new Error('No pending input resolver')
  }
  inputResolve(response)
  inputResolve = null
}

export function killCollabSession(sessionId: string): void {
  if (!activeSession || activeSession.id !== sessionId) {
    throw new Error('No matching active session')
  }
  abortController?.abort()
  activeSession.status = 'killed'
  activeSession.updatedAt = Date.now()
  activeSession.completedAt = Date.now()
  emitUpdate(activeSession)
  finalize(activeSession)
}

// === Internal ===

function snapshot(session: CollabSession): CollabSession {
  return {
    ...session,
    turns: [...session.turns],
    conversationHistory: [...session.conversationHistory],
  }
}

function launchSession(session: CollabSession, maxRounds: number) {
  activeSession = session
  abortController = new AbortController()

  runLoop(session, maxRounds, abortController.signal).catch((err) => {
    if (session.status === 'running') {
      session.status = 'errored'
      session.errorMessage = err.message
      session.updatedAt = Date.now()
      emitUpdate(session)
      finalize(session)
    }
  })
}

function emitUpdate(session: CollabSession) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('collab:update', snapshot(session))
  }
}

function finalize(session: CollabSession) {
  if (onSessionComplete) {
    onSessionComplete(snapshot(session))
  }
  activeSession = null
  abortController = null
  inputResolve = null
}

function calcCost(agent: CollabAgent, tokensIn: number, tokensOut: number): number {
  const inRate = agent === 'claude' ? COST_CLAUDE_IN : COST_GPT_IN
  const outRate = agent === 'claude' ? COST_CLAUDE_OUT : COST_GPT_OUT
  return (tokensIn / 1_000_000) * inRate + (tokensOut / 1_000_000) * outRate
}

function checkForUserInput(content: string): string | null {
  const idx = content.indexOf(NEED_INPUT_TAG)
  if (idx === -1) return null
  return content.slice(idx + NEED_INPUT_TAG.length).trim()
}

function checkTaskComplete(content: string): boolean {
  return content.includes('TASK_COMPLETE')
}

async function waitForUserInput(session: CollabSession, question: string): Promise<string> {
  session.status = 'awaiting_input'
  session.inputQuestion = question
  session.updatedAt = Date.now()
  emitUpdate(session)

  return new Promise<string>((resolve) => {
    inputResolve = (response: string) => {
      session.status = 'running'
      session.inputQuestion = undefined
      session.updatedAt = Date.now()
      emitUpdate(session)
      resolve(response)
    }
  })
}

function callProxy(
  endpoint: string,
  body: object,
  signal?: AbortSignal
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'))
      return
    }

    const url = new URL(PROXY_BASE + endpoint)
    const bodyStr = JSON.stringify(body)

    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
      timeout: 120000,
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          let content = parsed.choices?.[0]?.message?.content || ''
          // GPT 5.x may include <thinking> tags — strip them
          content = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim()
          const tokensIn = parsed.usage?.prompt_tokens || 0
          const tokensOut = parsed.usage?.completion_tokens || 0
          resolve({ content, tokensIn, tokensOut })
        } catch {
          reject(new Error(`Invalid JSON from proxy: ${data.slice(0, 200)}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Proxy request timed out')) })

    if (signal) {
      signal.addEventListener('abort', () => { req.destroy(); reject(new Error('Aborted')) }, { once: true })
    }

    req.write(bodyStr)
    req.end()
  })
}

async function callAgent(
  session: CollabSession,
  agentName: CollabAgent,
  systemPrompt: string,
  endpoint: string,
  model: string,
  signal: AbortSignal
): Promise<string> {
  const label = agentName === 'claude' ? 'Claude' : 'GPT-5.4'
  const messages = [
    { role: 'system', content: systemPrompt },
    ...session.conversationHistory,
  ]

  const start = Date.now()
  const { content, tokensIn, tokensOut } = await callProxy(endpoint, {
    model,
    messages,
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
  }, signal)

  if (!content) throw new Error(`Empty response from ${label}`)

  const durationMs = Date.now() - start
  const costUsd = calcCost(agentName, tokensIn, tokensOut)

  const turn: CollabTurn = {
    id: crypto.randomUUID(),
    agent: agentName,
    content,
    tokensIn,
    tokensOut,
    costUsd,
    durationMs,
    timestamp: Date.now(),
  }

  // Update shared conversation history on the session
  session.conversationHistory.push({
    role: 'assistant',
    content: `[${label}]: ${content}`,
  })

  // Update session
  session.turns.push(turn)
  session.totalCostUsd += costUsd
  session.updatedAt = Date.now()
  emitUpdate(session)

  return content
}

async function runLoop(session: CollabSession, maxRounds: number, signal: AbortSignal) {
  let rounds = 0

  while (session.status === 'running') {
    if (signal.aborted) return

    rounds++
    session.roundCount = rounds

    // === Claude's turn ===
    const claudeContent = await callAgent(
      session, 'claude', CLAUDE_SYSTEM, CLAUDE_ENDPOINT, CLAUDE_MODEL, signal
    )

    const claudeQ = checkForUserInput(claudeContent)
    if (claudeQ) {
      const answer = await waitForUserInput(session, claudeQ)
      if (signal.aborted) return
      session.conversationHistory.push({ role: 'user', content: answer })
      continue
    }

    if (checkTaskComplete(claudeContent)) {
      session.status = 'completed'
      session.summary = claudeContent
      session.completedAt = Date.now()
      session.updatedAt = Date.now()
      emitUpdate(session)
      finalize(session)
      return
    }

    if (signal.aborted) return

    // === GPT's turn ===
    const gptContent = await callAgent(
      session, 'gpt', GPT_SYSTEM, GPT_ENDPOINT, GPT_MODEL, signal
    )

    const gptQ = checkForUserInput(gptContent)
    if (gptQ) {
      const answer = await waitForUserInput(session, gptQ)
      if (signal.aborted) return
      session.conversationHistory.push({ role: 'user', content: answer })
      continue
    }

    if (checkTaskComplete(gptContent)) {
      session.status = 'completed'
      session.summary = gptContent
      session.completedAt = Date.now()
      session.updatedAt = Date.now()
      emitUpdate(session)
      finalize(session)
      return
    }

    // === Auto check-in after N rounds ===
    if (rounds >= maxRounds) {
      const answer = await waitForUserInput(
        session,
        `${rounds} rounds complete. Provide direction, type "continue" to keep going, or "done" to stop.`
      )
      if (signal.aborted) return

      if (answer.toLowerCase() === 'done') {
        session.status = 'completed'
        session.summary = 'Stopped by user at check-in.'
        session.completedAt = Date.now()
        session.updatedAt = Date.now()
        emitUpdate(session)
        finalize(session)
        return
      } else if (answer.toLowerCase() !== 'continue') {
        session.conversationHistory.push({ role: 'user', content: answer })
      }
      rounds = 0
    }
  }
}

// === Codex (GPT 5.4) standalone chat ===

const CODEX_SYSTEM = `You are GPT-5.4 (Codex), a senior software architect and code reviewer. The user may provide project file trees and source code for you to review.

When reviewing code:
- Focus on architecture, patterns, correctness, and potential issues
- Be specific — reference file names and line-level concerns
- Suggest concrete improvements, not vague advice
- If the code is good, say so briefly and move on

Be direct and concise. No pleasantries.`

export async function codexChat(
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const fullMessages = [
    { role: 'system', content: CODEX_SYSTEM },
    ...messages,
  ]

  const { content, tokensIn, tokensOut } = await callProxy(GPT_ENDPOINT, {
    model: GPT_MODEL,
    messages: fullMessages,
    max_tokens: MAX_TOKENS,
    temperature: 0.5,
  })

  if (!content) throw new Error('Empty response from Codex')
  return { content, tokensIn, tokensOut }
}

export function readProjectTree(projectPath: string, maxDepth = 3): string {
  const fs = require('fs')
  const path = require('path')
  const lines: string[] = []
  const IGNORE = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
    '.venv', 'venv', '.cache', '.turbo', 'coverage', '.parcel-cache',
  ])

  function walk(dir: string, prefix: string, depth: number) {
    if (depth > maxDepth) return
    let entries: string[]
    try {
      entries = fs.readdirSync(dir).sort()
    } catch {
      return
    }
    for (const name of entries) {
      if (name.startsWith('.') && name !== '.env.example') continue
      if (IGNORE.has(name)) continue
      const full = path.join(dir, name)
      let stat
      try { stat = fs.statSync(full) } catch { continue }
      if (stat.isDirectory()) {
        lines.push(`${prefix}${name}/`)
        walk(full, prefix + '  ', depth + 1)
      } else {
        const kb = (stat.size / 1024).toFixed(1)
        lines.push(`${prefix}${name} (${kb}k)`)
      }
    }
  }

  lines.push(`${path.basename(projectPath)}/`)
  walk(projectPath, '  ', 1)
  return lines.join('\n')
}

export function readFileContent(filePath: string): string {
  const fs = require('fs')
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    // Cap at ~50k chars to avoid blowing up context
    if (content.length > 50000) {
      return content.slice(0, 50000) + '\n\n[...truncated at 50k chars]'
    }
    return content
  } catch (err: any) {
    throw new Error(`Cannot read file: ${err.message}`)
  }
}
