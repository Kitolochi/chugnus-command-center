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
