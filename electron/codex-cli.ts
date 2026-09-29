import fs from 'fs'
import path from 'path'
import os from 'os'
import type { CodexSession, CodexTurnOptions } from '../src/types/codex'
import { extractResources, mergeResources, toolResources } from '../src/lib/conversationContext'

// Resolve native executables directly: spawning npm .cmd wrappers requires a shell on Windows.
export function resolveCodexBinary(): string {
  const exe = process.platform === 'win32' ? 'codex.exe' : 'codex'
  const candidates = [
    process.env.CODEX_BINARY,
    path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'OpenAI', 'Codex', 'bin', exe),
    path.join(os.homedir(), '.local', 'bin', exe),
    ...(process.env.PATH || '').split(path.delimiter).map(dir => path.join(dir.replace(/^"|"$/g, ''), exe)),
  ]
  // npm distributions carry the native binary inside their platform package.
  const npmRoot = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@openai')
  for (const platform of ['codex-win32-x64', 'codex-win32-arm64']) {
    for (const root of [path.join(npmRoot, platform), path.join(npmRoot, 'codex', 'node_modules', '@openai', platform), path.join(npmRoot, 'codex')]) {
      const triple = platform.endsWith('arm64') ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc'
      candidates.push(path.join(root, 'vendor', triple, 'codex', exe))
    }
  }
  const found = candidates.find(candidate => candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile())
  if (!found) throw new Error('Codex CLI was not found. Install Codex or set CODEX_BINARY to its executable, then restart Command Center.')
  return found
}

export function buildCodexArgs(opts: CodexTurnOptions, threadId?: string): string[] {
  const args = ['exec', '--json', '--skip-git-repo-check', '-c', 'approval_policy="never"', '--sandbox', opts.access]
  if (process.platform === 'win32' && opts.windowsSandbox === 'unelevated') args.push('-c', 'windows.sandbox="unelevated"')
  if (opts.model?.trim()) args.push('--model', opts.model.trim())
  if (opts.effort) args.push('-c', `model_reasoning_effort=${JSON.stringify(opts.effort)}`)
  // Parent exec options apply to resume as well; resume itself has no --sandbox flag.
  if (threadId) args.push('resume', threadId)
  for (const file of opts.attachments || []) {
    if (/\.(png|jpe?g|webp|gif)$/i.test(file)) args.push('--image', file)
  }
  args.push('-') // Prompt goes over stdin, never through a shell or command-line interpolation.
  return args
}

export function applyCodexEvent(session: CodexSession, event: any, turnId: string): void {
  session.lastEventAt = Date.now()
  const request = session.messages.find(m => m.id === `${turnId}-user`)
  if (request && (event.type === 'turn.started' || event.type?.startsWith('item.')) && request.state === 'starting') {
    request.state = 'working'
    request.startedAt = Date.now()
  }
  if (event.type === 'thread.started') session.threadId = event.thread_id
  if (event.type === 'turn.completed') {
    session.tokensIn += event.usage?.input_tokens || 0
    session.tokensOut += event.usage?.output_tokens || 0
    session.turns++
    if (request) { request.state = 'completed'; request.finishedAt = Date.now() }
  }
  if (event.type === 'turn.failed') {
    session.status = 'error'
    session.error = event.error?.message || 'Codex turn failed'
    if (request) { request.state = 'failed'; request.finishedAt = Date.now() }
  }
  // Transient reconnect errors are activity; a later successful turn can recover.
  if (event.type === 'error') {
    session.activity.push({ id: `${turnId}-error-${session.activity.length}`, kind: 'error', text: event.message || 'Codex connection error' })
  }
  const item = event.item
  if (!item) return
  session.resources = mergeResources(session.resources || [], item.type === 'agent_message'
    ? extractResources(item.text || '')
    : toolResources(item))
  const id = `${turnId}-${item.id}`
  if (item.type === 'agent_message') {
    const message = { role: 'assistant' as const, content: (item.text || '').slice(0, 100000), id }
    const index = session.messages.findIndex(m => m.id === id)
    if (index < 0) session.messages.push(message)
    else session.messages[index] = message
  } else {
    const text = item.command
      ? `${item.command}\n${item.aggregated_output || ''}`
      : item.text || item.query || (item.type === 'mcp_tool_call' ? `${item.server}: ${item.tool}\n${JSON.stringify(item.arguments || {})}` : JSON.stringify(item.changes || item.items || item))
    const activity = { id, kind: item.type, text: text.slice(0, 16000), status: item.status || (event.type === 'item.completed' ? 'completed' : 'in_progress'), updatedAt: Date.now() }
    const index = session.activity.findIndex(a => a.id === id)
    if (index < 0) session.activity.push(activity)
    else session.activity[index] = activity
    session.activity = session.activity.slice(-200)
  }
  if (item.type === 'file_change' && event.type === 'item.completed' && item.status !== 'failed') {
    for (const change of item.changes || []) {
      if (change.path && !session.filesChanged.includes(change.path)) session.filesChanged.push(change.path)
      if (change.path) session.resources = mergeResources(session.resources || [], [{ kind: 'file', value: change.path, evidence: 'changed' }])
    }
  }
}
