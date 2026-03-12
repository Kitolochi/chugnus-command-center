import { spawn, ChildProcess } from 'child_process'
import crypto from 'crypto'
import path from 'path'
import os from 'os'
import { BrowserWindow } from 'electron'
import { updateCCHistoryEntry } from './database'

// --- Types ---

export interface CCQueueItem {
  processId: string
  sessionId?: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  status: 'working' | 'awaiting_input' | 'errored'
  resultText?: string
  errorMessage?: string
  filesChanged: string[]
  fullLog: CCStreamMessage[]
  costUsd: number
  turnCount: number
  startedAt: number
  updatedAt: number
}

export interface CCStreamMessage {
  type: string
  subtype?: string
  text?: string
  toolName?: string
  toolInput?: string
  timestamp: number
}

interface ManagedProcess {
  proc: ChildProcess
  item: CCQueueItem
  buffer: string
}

// --- Constants ---

const ACCENT_COLORS = ['blue', 'purple', 'red', 'cyan', 'green', 'orange', 'amber', 'pink']
const MAX_PROCESSES = 10

// --- State ---

const processes = new Map<string, ManagedProcess>()
let mainWindow: BrowserWindow | null = null

// --- Helpers ---

function hashColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length]
}

function notifyRenderer() {
  mainWindow?.webContents.send('cc:queue-update', getQueue())
}

// --- Public API ---

export function initCommandCenter(win: BrowserWindow) {
  mainWindow = win
}

export function getQueue(): CCQueueItem[] {
  return Array.from(processes.values()).map(m => ({ ...m.item }))
}

export function getProcessCount(): number {
  return processes.size
}

export function launchProcess(opts: {
  projectPath: string
  prompt: string
  model?: string
  maxBudget?: number
  resumeSessionId?: string
}): CCQueueItem {
  if (processes.size >= MAX_PROCESSES) {
    throw new Error('Max concurrent tasks reached (10)')
  }

  // Prevent resuming a session that's already running
  if (opts.resumeSessionId) {
    for (const [, m] of processes) {
      if (m.item.sessionId === opts.resumeSessionId) {
        throw new Error('This session is already running')
      }
    }
  }

  const processId = crypto.randomUUID()
  const projectName = path.basename(opts.projectPath)
  const projectColor = hashColor(opts.projectPath)

  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
  ]
  if (opts.resumeSessionId) {
    args.push('--resume', opts.resumeSessionId)
  }
  if (opts.model) args.push('--model', opts.model)
  if (opts.maxBudget) args.push('--max-budget-usd', String(opts.maxBudget))

  // Use full path to avoid shell: true buffering issues on Windows
  const claudePath = path.join(os.homedir(), '.local', 'bin', 'claude.exe')
  const proc = spawn(claudePath, args, {
    cwd: opts.projectPath,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  })

  const item: CCQueueItem = {
    processId,
    sessionId: opts.resumeSessionId,
    projectPath: opts.projectPath,
    projectName,
    projectColor,
    prompt: opts.prompt,
    status: 'working',
    filesChanged: [],
    fullLog: [],
    costUsd: 0,
    turnCount: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  }

  const managed: ManagedProcess = { proc, item, buffer: '' }
  processes.set(processId, managed)

  // Send user message immediately for both new and resumed sessions.
  // stream-json input mode won't emit any output until it receives stdin input,
  // so we must send the prompt first — the system init message arrives after.
  const prompt = opts.resumeSessionId
    ? (opts.prompt || 'Continue where we left off.')
    : opts.prompt
  const msg = JSON.stringify({
    type: 'user',
    message: { role: 'user', content: prompt }
  }) + '\n'
  proc.stdin?.write(msg)

  // Handle stdout (stream-json, newline-delimited)
  proc.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString()
    managed.buffer += chunk
    const lines = managed.buffer.split('\n')
    managed.buffer = lines.pop() || '' // keep incomplete line in buffer
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        handleMessage(processId, parsed)
      } catch {
        // Non-JSON line, skip
      }
    }
  })

  // Flush buffer when stdout closes (ensures last message is processed)
  proc.stdout?.on('end', () => {
    if (managed.buffer.trim()) {
      try {
        const parsed = JSON.parse(managed.buffer)
        handleMessage(processId, parsed)
      } catch { /* incomplete JSON, discard */ }
      managed.buffer = ''
    }
  })

  // Handle stderr
  let stderrBuf = ''
  proc.stderr?.on('data', (data: Buffer) => {
    const s = data.toString()
    stderrBuf += s
    if (stderrBuf.length > 2000) stderrBuf = stderrBuf.slice(-2000)
  })

  // Handle exit — flush remaining buffer first
  proc.on('close', (code) => {
    const m = processes.get(processId)
    if (!m) return

    // Flush any remaining data in the stdout buffer
    if (m.buffer.trim()) {
      try {
        const parsed = JSON.parse(m.buffer)
        handleMessage(processId, parsed)
      } catch { /* incomplete JSON, discard */ }
      m.buffer = ''
    }

    if (m.item.status === 'working') {
      // Unexpected exit
      m.item.status = 'errored'
      m.item.errorMessage = `Process exited with code ${code}. ${stderrBuf.slice(-500)}`
      m.item.updatedAt = Date.now()
      notifyRenderer()
    }
  })

  proc.on('error', (err) => {
    const m = processes.get(processId)
    if (!m) return
    m.item.status = 'errored'
    m.item.errorMessage = err.message
    m.item.updatedAt = Date.now()
    notifyRenderer()
  })

  notifyRenderer()
  return item
}

function handleMessage(processId: string, msg: any) {
  const m = processes.get(processId)
  if (!m) return

  const { item } = m
  const timestamp = Date.now()

  if (msg.type === 'assistant' && msg.message?.content) {
    for (const block of msg.message.content) {
      if (block.type === 'text') {
        item.fullLog.push({ type: 'assistant', text: block.text, timestamp })
        item.resultText = block.text // latest text
      } else if (block.type === 'tool_use') {
        item.fullLog.push({
          type: 'tool_use',
          toolName: block.name,
          toolInput: JSON.stringify(block.input || {}).slice(0, 200),
          timestamp,
        })
        // Track file changes
        if ((block.name === 'Edit' || block.name === 'Write') && block.input?.file_path) {
          const fp = block.input.file_path
          if (!item.filesChanged.includes(fp)) item.filesChanged.push(fp)
        }
      }
    }
    item.updatedAt = timestamp
    notifyRenderer()
  } else if (msg.type === 'result') {
    item.turnCount++
    if (msg.total_cost_usd != null) item.costUsd = msg.total_cost_usd
    if (msg.result) item.resultText = msg.result

    if (msg.subtype === 'error' || msg.is_error) {
      item.status = 'errored'
      item.errorMessage = msg.result || msg.error || msg.message || JSON.stringify(msg).slice(0, 500)
    } else {
      item.status = 'awaiting_input'
    }
    item.updatedAt = timestamp
    notifyRenderer()
  }
  // Capture session ID from system init message and persist immediately
  if (msg.type === 'system' && msg.session_id) {
    item.sessionId = msg.session_id
    updateCCHistoryEntry(item.processId, { sessionId: msg.session_id })
    notifyRenderer()
  }
}

export function respondToProcess(processId: string, response: string) {
  const m = processes.get(processId)
  if (!m) throw new Error(`Process ${processId} not found`)
  if (!m.proc.stdin?.writable) {
    m.item.status = 'errored'
    m.item.errorMessage = 'Process stdin is closed (EPIPE)'
    m.item.updatedAt = Date.now()
    notifyRenderer()
    throw new Error('Process stdin closed')
  }

  const msg = JSON.stringify({
    type: 'user',
    message: { role: 'user', content: response }
  }) + '\n'

  m.item.fullLog.push({ type: 'user', text: response, timestamp: Date.now() })
  m.item.status = 'working'
  m.item.updatedAt = Date.now()

  try {
    m.proc.stdin.write(msg)
  } catch (err: any) {
    m.item.status = 'errored'
    m.item.errorMessage = `Write failed: ${err.message}`
    m.item.updatedAt = Date.now()
  }
  notifyRenderer()
}

export function dismissProcess(processId: string): CCQueueItem | null {
  const m = processes.get(processId)
  if (!m) return null

  const finalItem = { ...m.item, status: 'completed' as const, updatedAt: Date.now() }
  const proc = m.proc  // capture ref before deleting from map

  try { proc.stdin?.end() } catch {}
  processes.delete(processId)
  notifyRenderer()

  // Clean up process after stdin closes
  setTimeout(() => { try { proc.kill() } catch {} }, 1000)

  return finalItem
}

export function killProcess(processId: string): CCQueueItem | null {
  const m = processes.get(processId)
  if (!m) return null

  const finalItem = { ...m.item }
  try { m.proc.kill('SIGTERM') } catch {}
  setTimeout(() => { try { m.proc.kill('SIGKILL') } catch {} }, 5000)
  processes.delete(processId)
  notifyRenderer()
  return finalItem
}

export function shutdownAllProcesses(): Promise<void> {
  return new Promise((resolve) => {
    for (const [id] of processes) {
      try { processes.get(id)?.proc.kill('SIGTERM') } catch {}
    }
    setTimeout(() => {
      for (const [id] of processes) {
        try { processes.get(id)?.proc.kill('SIGKILL') } catch {}
      }
      processes.clear()
      resolve()
    }, 3000)
  })
}
