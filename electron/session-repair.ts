import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface RepairAnalysis {
  filePath: string
  exists: boolean
  totalLines: number
  validLines: number
  healthy: boolean
  issue?: string
  truncateAt?: number
  danglingToolUseIds: string[]
}

export interface RepairResult {
  ok: boolean
  message: string
  backupPath?: string
  removedLines?: number
  keptLines?: number
}

function findSessionFile(sessionId: string, preferredCwd: string): string | null {
  const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects')
  const sessionFile = `${sessionId}.jsonl`

  const encodedPreferred = preferredCwd.replace(':', '-').replace(/[\\/]/g, '-')
  const preferredPath = path.join(claudeProjectsDir, encodedPreferred, sessionFile)
  if (fs.existsSync(preferredPath)) return preferredPath

  try {
    const dirs = fs.readdirSync(claudeProjectsDir, { withFileTypes: true })
    for (const d of dirs) {
      if (!d.isDirectory()) continue
      const candidate = path.join(claudeProjectsDir, d.name, sessionFile)
      if (fs.existsSync(candidate)) return candidate
    }
  } catch {}

  return null
}

function isAssistant(obj: any): boolean {
  return obj && obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)
}

function isUser(obj: any): boolean {
  return obj && obj.type === 'user' && obj.message && Array.isArray(obj.message.content)
}

function collectToolResultIds(parsed: any[]): Set<string> {
  const ids = new Set<string>()
  for (const obj of parsed) {
    if (!isUser(obj)) continue
    for (const block of obj.message.content) {
      if (block?.type === 'tool_result' && block.tool_use_id) ids.add(block.tool_use_id)
    }
  }
  return ids
}

function getToolUseIds(obj: any): string[] {
  if (!isAssistant(obj)) return []
  return obj.message.content
    .filter((b: any) => b?.type === 'tool_use' && typeof b.id === 'string')
    .map((b: any) => b.id)
}

function isTextOnlyAssistant(obj: any): boolean {
  if (!isAssistant(obj)) return false
  const content = obj.message.content
  if (content.length === 0) return false
  return content.every((b: any) => b?.type === 'text' || b?.type === 'thinking')
}

export function analyzeSession(sessionId: string, preferredCwd: string): RepairAnalysis {
  const filePath = findSessionFile(sessionId, preferredCwd)
  if (!filePath) {
    return {
      filePath: '',
      exists: false,
      totalLines: 0,
      validLines: 0,
      healthy: false,
      issue: 'Session file not found',
      danglingToolUseIds: [],
    }
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n')
  const parsed: any[] = []
  let validCount = 0
  for (const line of lines) {
    if (!line.trim()) {
      parsed.push(null)
      continue
    }
    try {
      parsed.push(JSON.parse(line))
      validCount++
    } catch {
      parsed.push(null)
    }
  }

  const resultIds = collectToolResultIds(parsed)

  let lastAssistantWithUnmatched = -1
  const danglingIds: string[] = []
  for (let i = 0; i < parsed.length; i++) {
    const obj = parsed[i]
    if (!isAssistant(obj)) continue
    const useIds = getToolUseIds(obj)
    if (useIds.length === 0) continue
    const unmatched = useIds.filter((id) => !resultIds.has(id))
    if (unmatched.length > 0) {
      if (lastAssistantWithUnmatched === -1) {
        lastAssistantWithUnmatched = i
        danglingIds.push(...unmatched)
      }
    }
  }

  if (lastAssistantWithUnmatched === -1) {
    return {
      filePath,
      exists: true,
      totalLines: lines.length,
      validLines: validCount,
      healthy: true,
      danglingToolUseIds: [],
    }
  }

  let safeStop = -1
  for (let i = lastAssistantWithUnmatched - 1; i >= 0; i--) {
    if (isTextOnlyAssistant(parsed[i])) {
      safeStop = i
      break
    }
  }

  return {
    filePath,
    exists: true,
    totalLines: lines.length,
    validLines: validCount,
    healthy: false,
    issue: `${danglingIds.length} unmatched tool_use block(s) — last one at line ${lastAssistantWithUnmatched + 1}`,
    truncateAt: safeStop === -1 ? 0 : safeStop + 1,
    danglingToolUseIds: danglingIds,
  }
}

export function repairSession(sessionId: string, preferredCwd: string): RepairResult {
  const analysis = analyzeSession(sessionId, preferredCwd)
  if (!analysis.exists) return { ok: false, message: 'Session file not found' }
  if (analysis.healthy)
    return { ok: true, message: 'Session was already healthy', removedLines: 0, keptLines: analysis.totalLines }
  if (analysis.truncateAt === undefined)
    return { ok: false, message: 'No safe truncation point — session has no completed assistant turn to roll back to' }

  const filePath = analysis.filePath
  const backupPath = `${filePath}.bak-${Date.now()}`
  fs.copyFileSync(filePath, backupPath)

  const raw = fs.readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n')
  const kept = lines.slice(0, analysis.truncateAt)
  const trimmed = kept.join('\n') + (kept.length > 0 ? '\n' : '')
  fs.writeFileSync(filePath, trimmed, 'utf-8')

  return {
    ok: true,
    message: `Trimmed ${lines.length - analysis.truncateAt} line(s), kept ${analysis.truncateAt}. Backup at ${path.basename(backupPath)}`,
    backupPath,
    removedLines: lines.length - analysis.truncateAt,
    keptLines: analysis.truncateAt,
  }
}
