import http from 'http'
import crypto from 'crypto'
import { BrowserWindow } from 'electron'

// === Types (mirroring src/types for main process) ===

type CollabAgent = 'claude' | 'gpt'

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
  totalCostUsd: number
  roundCount: number
  inputQuestion?: string
  summary?: string
  errorMessage?: string
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

// === Public API ===

export function initDualAgent(win: BrowserWindow) {
  mainWindow = win
}

export function setOnSessionComplete(cb: (session: CollabSession) => void) {
  onSessionComplete = cb
}

export function getActiveCollabSession(): CollabSession | null {
  return activeSession ? { ...activeSession, turns: [...activeSession.turns] } : null
}

export function startCollabSession(task: string, maxRounds = 4): { sessionId: string } {
  if (activeSession && activeSession.status === 'running') {
    throw new Error('A collab session is already running')
  }

  const session: CollabSession = {
    id: crypto.randomUUID(),
    task,
    status: 'running',
    turns: [],
    totalCostUsd: 0,
    roundCount: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  }

  activeSession = session
  abortController = new AbortController()

  // Fire and forget the async loop
  runLoop(session, maxRounds, abortController.signal).catch((err) => {
    if (session.status === 'running') {
      session.status = 'errored'
      session.errorMessage = err.message
      session.updatedAt = Date.now()
      emitUpdate(session)
      finalize(session)
    }
  })

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

function emitUpdate(session: CollabSession) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('collab:update', { ...session, turns: [...session.turns] })
  }
}

function finalize(session: CollabSession) {
  if (onSessionComplete) {
    onSessionComplete({ ...session, turns: [...session.turns] })
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
  conversationHistory: Array<{ role: string; content: string }>,
  signal: AbortSignal
): Promise<{ content: string; turn: CollabTurn }> {
  const label = agentName === 'claude' ? 'Claude' : 'GPT-5.4'
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
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

  // Add to shared history
  conversationHistory.push({
    role: 'assistant',
    content: `[${label}]: ${content}`,
  })

  // Update session
  session.turns.push(turn)
  session.totalCostUsd += costUsd
  session.updatedAt = Date.now()
  emitUpdate(session)

  return { content, turn }
}

async function runLoop(session: CollabSession, maxRounds: number, signal: AbortSignal) {
  const conversationHistory: Array<{ role: string; content: string }> = [
    { role: 'user', content: session.task },
  ]

  let rounds = 0

  while (session.status === 'running') {
    if (signal.aborted) return

    rounds++
    session.roundCount = rounds

    // === Claude's turn ===
    const { content: claudeContent } = await callAgent(
      session, 'claude', CLAUDE_SYSTEM, CLAUDE_ENDPOINT, CLAUDE_MODEL,
      conversationHistory, signal
    )

    const claudeQ = checkForUserInput(claudeContent)
    if (claudeQ) {
      const answer = await waitForUserInput(session, claudeQ)
      if (signal.aborted) return
      conversationHistory.push({ role: 'user', content: answer })
      continue // Claude goes again
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
    const { content: gptContent } = await callAgent(
      session, 'gpt', GPT_SYSTEM, GPT_ENDPOINT, GPT_MODEL,
      conversationHistory, signal
    )

    const gptQ = checkForUserInput(gptContent)
    if (gptQ) {
      const answer = await waitForUserInput(session, gptQ)
      if (signal.aborted) return
      conversationHistory.push({ role: 'user', content: answer })
      continue // GPT goes again
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
        conversationHistory.push({ role: 'user', content: answer })
      }
      rounds = 0
    }
  }
}
