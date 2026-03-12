import fs from 'fs'
import path from 'path'
import readline from 'readline'
import os from 'os'
import { discoverSessions, type SessionMeta } from './session-parser'
import type {
  AVStats, AVSummary, AVTools, AVToolCategory, AVHeatmap, AVHeatmapEntry,
  AVProjects, AVProject, AVSessions, AVSessionDistribution,
  AVTopSessions, AVTopSession, AVSessionList, AVSessionListItem,
  AVSessionDetail, AVSessionMessages, AVMessage, AVSearchResults, AVSearchResult,
  AVActivity, AVActivitySeries, AVHourOfWeek, AVHourOfWeekCell,
} from '../src/types'

// === Cost estimation (per 1M tokens) ===

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-opus-4': { input: 15, output: 75 },
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.80, output: 4 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4 },
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Find matching cost entry by prefix
  let costs = { input: 3, output: 15 } // default to sonnet pricing
  for (const [key, val] of Object.entries(MODEL_COSTS)) {
    if (model.startsWith(key) || model.includes(key)) {
      costs = val
      break
    }
  }
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output
}

// === Per-session summary (cached) ===

interface SessionSummary {
  sessionId: string
  project: string        // encoded directory name
  projectFriendly: string
  filePath: string
  fileSize: number
  cacheKey: string       // `${size}:${mtimeMs}`

  firstMessage: string
  startedAt: string      // ISO
  endedAt: string        // ISO
  durationMin: number

  userMessages: number
  assistantMessages: number
  totalMessages: number
  model: string

  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costEstimate: number

  toolCalls: Map<string, number>
  totalToolCalls: number
  gitCommits: string[]
  filesChanged: string[]
}

// === In-memory cache ===

const summaryCache = new Map<string, SessionSummary>()

function cacheKey(meta: SessionMeta): string {
  return `${meta.size}:${meta.mtimeMs}`
}

function friendlyProjectName(dirName: string): string {
  // "C--Users-chris-mega-agenda" → "mega-agenda"
  const parts = dirName.split('-').filter(Boolean)
  // Skip C, Users, username prefix
  const userIdx = parts.findIndex(p => p.toLowerCase() === 'users')
  if (userIdx >= 0 && userIdx + 2 < parts.length) {
    return parts.slice(userIdx + 2).join('-')
  }
  if (parts.length > 3) return parts.slice(-2).join('-')
  if (parts.length > 1) return parts[parts.length - 1]
  return dirName
}

// === Parse a single session file into a SessionSummary ===

async function parseSessionForAnalytics(meta: SessionMeta): Promise<SessionSummary> {
  return new Promise((resolve) => {
    let userMessages = 0
    let assistantMessages = 0
    let inputTokens = 0
    let outputTokens = 0
    let cacheCreationTokens = 0
    let cacheReadTokens = 0
    let model = ''
    let firstMessage = ''
    let firstTimestamp = ''
    let lastTimestamp = ''
    const toolCalls = new Map<string, number>()
    const gitCommits: string[] = []
    const filesChanged = new Set<string>()

    const stream = fs.createReadStream(meta.path, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line)

        // Skip non-message types
        if (['file-history-snapshot', 'summary', 'progress', 'system'].includes(parsed.type)) return
        if (parsed.isMeta) return

        // Track timestamps
        if (parsed.timestamp) {
          if (!firstTimestamp) firstTimestamp = parsed.timestamp
          lastTimestamp = parsed.timestamp
        }

        if (parsed.type === 'user') {
          userMessages++
          if (!firstMessage) {
            const text = extractText(parsed)
            if (text && text.length > 5) {
              firstMessage = text.slice(0, 150)
            }
          }
        }

        if (parsed.type === 'assistant') {
          assistantMessages++

          // Token usage
          const usage = parsed.message?.usage
          if (usage) {
            inputTokens += usage.input_tokens || 0
            outputTokens += usage.output_tokens || 0
            cacheCreationTokens += usage.cache_creation_input_tokens || 0
            cacheReadTokens += usage.cache_read_input_tokens || 0
          }

          if (parsed.message?.model) model = parsed.message.model

          // Tool use blocks
          if (Array.isArray(parsed.message?.content)) {
            for (const block of parsed.message.content) {
              if (block.type === 'tool_use' && block.name) {
                toolCalls.set(block.name, (toolCalls.get(block.name) || 0) + 1)

                // Track files
                if ((block.name === 'Write' || block.name === 'Edit') && block.input?.file_path) {
                  filesChanged.add(block.input.file_path)
                }

                // Detect git commits
                if (block.name === 'Bash' && typeof block.input?.command === 'string') {
                  const cmd = block.input.command
                  const commitMatch = cmd.match(/git commit\s+-m\s+["']([^"']+)["']/)
                  if (commitMatch) gitCommits.push(commitMatch[1])
                  // Also match heredoc-style commits
                  if (cmd.includes('git commit') && !commitMatch) {
                    const heredocMatch = cmd.match(/git commit\s+-m\s+"\$\(cat <</)
                    if (heredocMatch) gitCommits.push('[heredoc commit]')
                  }
                }
              }
            }
          }
        }
      } catch {}
    })

    rl.on('close', () => {
      const totalMessages = userMessages + assistantMessages
      let totalToolCalls = 0
      for (const count of toolCalls.values()) totalToolCalls += count

      const startedAt = firstTimestamp || new Date(meta.mtimeMs).toISOString()
      const endedAt = lastTimestamp || startedAt
      const durationMin = Math.max(0, (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)

      resolve({
        sessionId: meta.sessionId,
        project: meta.project,
        projectFriendly: friendlyProjectName(meta.project),
        filePath: meta.path,
        fileSize: meta.size,
        cacheKey: cacheKey(meta),
        firstMessage,
        startedAt,
        endedAt,
        durationMin,
        userMessages,
        assistantMessages,
        totalMessages,
        model,
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
        costEstimate: estimateCost(model, inputTokens, outputTokens),
        toolCalls,
        totalToolCalls,
        gitCommits,
        filesChanged: Array.from(filesChanged),
      })
    })

    rl.on('error', () => {
      resolve({
        sessionId: meta.sessionId,
        project: meta.project,
        projectFriendly: friendlyProjectName(meta.project),
        filePath: meta.path,
        fileSize: meta.size,
        cacheKey: cacheKey(meta),
        firstMessage: '',
        startedAt: new Date(meta.mtimeMs).toISOString(),
        endedAt: new Date(meta.mtimeMs).toISOString(),
        durationMin: 0,
        userMessages: 0,
        assistantMessages: 0,
        totalMessages: 0,
        model: '',
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costEstimate: 0,
        toolCalls: new Map(),
        totalToolCalls: 0,
        gitCommits: [],
        filesChanged: [],
      })
    })
  })
}

function extractText(parsed: any): string {
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

// === Core: load all sessions (with caching) ===

async function loadAllSummaries(): Promise<SessionSummary[]> {
  const metas = discoverSessions()
  const results: SessionSummary[] = []

  // Invalidate stale cache entries
  const currentIds = new Set(metas.map(m => m.sessionId))
  for (const key of summaryCache.keys()) {
    if (!currentIds.has(key)) summaryCache.delete(key)
  }

  for (const meta of metas) {
    // Skip tiny files
    if (meta.size < 100) continue

    const ck = cacheKey(meta)
    const cached = summaryCache.get(meta.sessionId)
    if (cached && cached.cacheKey === ck) {
      results.push(cached)
      continue
    }

    const summary = await parseSessionForAnalytics(meta)
    // Only cache sessions with real content
    if (summary.totalMessages > 0) {
      summaryCache.set(meta.sessionId, summary)
      results.push(summary)
    }
  }

  return results
}

function filterByDays(summaries: SessionSummary[], days?: number): SessionSummary[] {
  if (!days) return summaries
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffISO = cutoff.toISOString()
  return summaries.filter(s => s.startedAt >= cutoffISO)
}

// === Public API: each function returns the AV* type the UI expects ===

export async function computeStats(): Promise<AVStats> {
  const all = await loadAllSummaries()
  const projects = new Set(all.map(s => s.projectFriendly))
  const machines = new Set(['local'])
  const totalMessages = all.reduce((sum, s) => sum + s.totalMessages, 0)
  const earliest = all.length > 0
    ? all.reduce((min, s) => s.startedAt < min ? s.startedAt : min, all[0].startedAt)
    : new Date().toISOString()

  return {
    session_count: all.length,
    message_count: totalMessages,
    project_count: projects.size,
    machine_count: machines.size,
    earliest_session: earliest,
  }
}

export async function computeSummary(days?: number): Promise<AVSummary> {
  const all = filterByDays(await loadAllSummaries(), days)
  const totalSessions = all.length
  const totalMessages = all.reduce((sum, s) => sum + s.totalMessages, 0)
  const totalCost = all.reduce((sum, s) => sum + s.costEstimate, 0)
  const totalCommits = all.reduce((sum, s) => sum + s.gitCommits.length, 0)

  const projects = new Set(all.map(s => s.projectFriendly))
  const days_ = new Set(all.map(s => s.startedAt.slice(0, 10)))

  // Message counts per session for percentiles
  const msgCounts = all.map(s => s.totalMessages).sort((a, b) => a - b)
  const median = msgCounts.length > 0 ? msgCounts[Math.floor(msgCounts.length / 2)] : 0
  const p90 = msgCounts.length > 0 ? msgCounts[Math.floor(msgCounts.length * 0.9)] : 0
  const avg = totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0

  // Most active project
  const projectCounts = new Map<string, number>()
  for (const s of all) {
    projectCounts.set(s.projectFriendly, (projectCounts.get(s.projectFriendly) || 0) + s.totalMessages)
  }
  let mostActive = ''
  let maxMsgs = 0
  for (const [proj, count] of projectCounts) {
    if (count > maxMsgs) { mostActive = proj; maxMsgs = count }
  }

  // Concentration (HHI)
  const concentration = totalMessages > 0
    ? Array.from(projectCounts.values()).reduce((sum, c) => sum + (c / totalMessages) ** 2, 0)
    : 0

  return {
    total_sessions: totalSessions,
    total_messages: totalMessages,
    active_projects: projects.size,
    active_days: days_.size,
    avg_messages: avg,
    median_messages: median,
    p90_messages: p90,
    most_active_project: mostActive,
    concentration,
    agents: {},
    // Extensions for Cost and Commits cards (cast as any since AV types don't have these)
    ...(({ total_cost: totalCost, total_commits: totalCommits }) as any),
  }
}

export async function computeHeatmap(): Promise<AVHeatmap> {
  const all = await loadAllSummaries()

  // Count sessions per day
  const dayCounts = new Map<string, number>()
  for (const s of all) {
    const date = s.startedAt.slice(0, 10)
    dayCounts.set(date, (dayCounts.get(date) || 0) + 1)
  }

  // Build entries for last 365 days
  const entries: AVHeatmapEntry[] = []
  const now = new Date()
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const value = dayCounts.get(dateStr) || 0
    const level = value === 0 ? 0 : value <= 2 ? 1 : value <= 5 ? 2 : value <= 10 ? 3 : 4
    entries.push({ date: dateStr, value, level })
  }

  return { metric: 'sessions', entries }
}

export async function computeActivity(days?: number): Promise<AVActivity> {
  const all = filterByDays(await loadAllSummaries(), days)

  const dayData = new Map<string, AVActivitySeries>()
  for (const s of all) {
    const date = s.startedAt.slice(0, 10)
    if (!dayData.has(date)) {
      dayData.set(date, {
        date,
        sessions: 0,
        messages: 0,
        user_messages: 0,
        assistant_messages: 0,
        tool_calls: 0,
        thinking_messages: 0,
        by_agent: {},
      })
    }
    const d = dayData.get(date)!
    d.sessions++
    d.messages += s.totalMessages
    d.user_messages += s.userMessages
    d.assistant_messages += s.assistantMessages
    d.tool_calls += s.totalToolCalls
  }

  const series = Array.from(dayData.values()).sort((a, b) => a.date.localeCompare(b.date))
  return { granularity: 'day', series }
}

export async function computeHourOfWeek(): Promise<AVHourOfWeek> {
  const all = await loadAllSummaries()

  // 7 days x 24 hours grid
  const grid = new Map<string, number>()
  for (const s of all) {
    const d = new Date(s.startedAt)
    const dow = d.getDay() // 0=Sun
    const hour = d.getHours()
    const key = `${dow}:${hour}`
    grid.set(key, (grid.get(key) || 0) + s.totalMessages)
  }

  const cells: AVHourOfWeekCell[] = []
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      const messages = grid.get(`${dow}:${hour}`) || 0
      if (messages > 0) {
        cells.push({ day_of_week: dow, hour, messages })
      }
    }
  }

  return { cells }
}

export async function computeTools(days?: number): Promise<AVTools> {
  const all = filterByDays(await loadAllSummaries(), days)

  const globalCounts = new Map<string, number>()
  const trendData = new Map<string, Map<string, number>>() // date → tool → count

  for (const s of all) {
    const date = s.startedAt.slice(0, 10)
    if (!trendData.has(date)) trendData.set(date, new Map())
    const dayTools = trendData.get(date)!

    for (const [tool, count] of s.toolCalls) {
      globalCounts.set(tool, (globalCounts.get(tool) || 0) + count)
      dayTools.set(tool, (dayTools.get(tool) || 0) + count)
    }
  }

  const totalCalls = Array.from(globalCounts.values()).reduce((s, c) => s + c, 0)
  const byCategory: AVToolCategory[] = Array.from(globalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      pct: totalCalls > 0 ? count / totalCalls : 0,
    }))

  const trend = Array.from(trendData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tools]) => {
      const byCategory: Record<string, number> = {}
      for (const [tool, count] of tools) byCategory[tool] = count
      return { date, by_category: byCategory }
    })

  return { total_calls: totalCalls, by_category: byCategory, by_agent: [], trend }
}

export async function computeProjects(): Promise<AVProjects> {
  const all = await loadAllSummaries()

  const projectData = new Map<string, {
    sessions: SessionSummary[]
    messages: number
  }>()

  for (const s of all) {
    const name = s.projectFriendly
    if (!projectData.has(name)) projectData.set(name, { sessions: [], messages: 0 })
    const pd = projectData.get(name)!
    pd.sessions.push(s)
    pd.messages += s.totalMessages
  }

  const projects: AVProject[] = Array.from(projectData.entries())
    .map(([name, data]) => {
      const msgCounts = data.sessions.map(s => s.totalMessages).sort((a, b) => a - b)
      const median = msgCounts.length > 0 ? msgCounts[Math.floor(msgCounts.length / 2)] : 0
      const sorted = data.sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt))

      return {
        name,
        sessions: data.sessions.length,
        messages: data.messages,
        first_session: sorted[0]?.startedAt.slice(0, 10) || '',
        last_session: sorted[sorted.length - 1]?.startedAt.slice(0, 10) || '',
        avg_messages: data.sessions.length > 0 ? Math.round(data.messages / data.sessions.length) : 0,
        median_messages: median,
        agents: {},
        daily_trend: 0,
      }
    })
    .sort((a, b) => b.messages - a.messages)

  return { projects }
}

export async function computeSessions(): Promise<AVSessions> {
  const all = await loadAllSummaries()

  // Length distribution (by message count)
  const lengthBuckets = [
    { label: '1-5', min: 1, max: 5 },
    { label: '6-15', min: 6, max: 15 },
    { label: '16-30', min: 16, max: 30 },
    { label: '31-50', min: 31, max: 50 },
    { label: '51-100', min: 51, max: 100 },
    { label: '100+', min: 101, max: Infinity },
  ]
  const lengthDist: AVSessionDistribution[] = lengthBuckets.map(b => ({
    label: b.label,
    count: all.filter(s => s.totalMessages >= b.min && s.totalMessages <= b.max).length,
  }))

  // Duration distribution (in minutes)
  const durationBuckets = [
    { label: '<5m', min: 0, max: 5 },
    { label: '5-15m', min: 5, max: 15 },
    { label: '15-30m', min: 15, max: 30 },
    { label: '30-60m', min: 30, max: 60 },
    { label: '1-3h', min: 60, max: 180 },
    { label: '3h+', min: 180, max: Infinity },
  ]
  const durationDist: AVSessionDistribution[] = durationBuckets.map(b => ({
    label: b.label,
    count: all.filter(s => s.durationMin >= b.min && s.durationMin < b.max).length,
  }))

  // Autonomy distribution (ratio of assistant to user messages)
  const autonomyBuckets = [
    { label: '<1:1', min: 0, max: 1 },
    { label: '1-2:1', min: 1, max: 2 },
    { label: '2-5:1', min: 2, max: 5 },
    { label: '5-10:1', min: 5, max: 10 },
    { label: '10+:1', min: 10, max: Infinity },
  ]
  const autonomyDist: AVSessionDistribution[] = autonomyBuckets.map(b => {
    const count = all.filter(s => {
      const ratio = s.userMessages > 0 ? s.assistantMessages / s.userMessages : 0
      return ratio >= b.min && ratio < b.max
    }).length
    return { label: b.label, count }
  })

  return {
    count: all.length,
    length_distribution: lengthDist,
    duration_distribution: durationDist,
    autonomy_distribution: autonomyDist,
  }
}

export async function computeTopSessions(): Promise<AVTopSessions> {
  const all = await loadAllSummaries()
  const sorted = [...all].sort((a, b) => b.totalMessages - a.totalMessages)

  const sessions: AVTopSession[] = sorted.slice(0, 20).map(s => ({
    id: s.sessionId,
    project: s.projectFriendly,
    first_message: s.firstMessage || s.sessionId,
    message_count: s.totalMessages,
    duration_min: s.durationMin,
  }))

  return { metric: 'message_count', sessions }
}

export async function getSessionList(opts?: {
  limit?: number
  project?: string
  search?: string
}): Promise<AVSessionList> {
  const all = await loadAllSummaries()
  const limit = opts?.limit ?? 50

  let filtered = all
  if (opts?.project) {
    filtered = filtered.filter(s => s.projectFriendly === opts.project)
  }
  if (opts?.search) {
    const q = opts.search.toLowerCase()
    filtered = filtered.filter(s =>
      s.firstMessage.toLowerCase().includes(q) ||
      s.sessionId.toLowerCase().includes(q) ||
      s.projectFriendly.toLowerCase().includes(q)
    )
  }

  // Sort by most recent first
  filtered.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const sessions: AVSessionListItem[] = filtered.slice(0, limit).map(s => ({
    id: s.sessionId,
    project: s.projectFriendly,
    machine: 'local',
    agent: 'claude',
    first_message: s.firstMessage || s.sessionId,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    message_count: s.totalMessages,
    user_message_count: s.userMessages,
    parent_session_id: null,
    relationship_type: null,
    created_at: s.startedAt,
  }))

  return {
    sessions,
    next_cursor: filtered.length > limit ? 'more' : null,
    total: filtered.length,
  }
}

export async function getSessionDetail(id: string): Promise<AVSessionDetail | null> {
  const all = await loadAllSummaries()
  const s = all.find(s => s.sessionId === id)
  if (!s) return null

  return {
    id: s.sessionId,
    project: s.projectFriendly,
    machine: 'local',
    agent: 'claude',
    first_message: s.firstMessage || s.sessionId,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    message_count: s.totalMessages,
    user_message_count: s.userMessages,
    parent_session_id: null,
    relationship_type: null,
    created_at: s.startedAt,
  }
}

export async function getSessionMessages(id: string, limit?: number): Promise<AVSessionMessages> {
  // Find the session file
  const projectsDir = path.join(os.homedir(), '.claude', 'projects')
  let filePath: string | null = null

  try {
    const dirs = fs.readdirSync(projectsDir, { withFileTypes: true }).filter(d => d.isDirectory())
    for (const d of dirs) {
      const fp = path.join(projectsDir, d.name, `${id}.jsonl`)
      if (fs.existsSync(fp)) { filePath = fp; break }
    }
  } catch {}

  if (!filePath) return { count: 0, messages: [] }

  return new Promise((resolve) => {
    const messages: AVMessage[] = []
    let ordinal = 0
    const maxMessages = limit ?? 200

    const stream = fs.createReadStream(filePath!, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line)
        if (['file-history-snapshot', 'summary', 'progress', 'system'].includes(parsed.type)) return
        if (parsed.isMeta) return
        if (parsed.type !== 'user' && parsed.type !== 'assistant') return

        const content = extractText(parsed)
        if (!content) return

        if (messages.length < maxMessages) {
          messages.push({
            id: ordinal,
            session_id: id,
            ordinal,
            role: parsed.type,
            content: content.slice(0, 5000),
          })
        }
        ordinal++
      } catch {}
    })

    rl.on('close', () => resolve({ count: ordinal, messages }))
    rl.on('error', () => resolve({ count: 0, messages: [] }))
  })
}

export async function searchSessions(query: string, limit?: number): Promise<AVSearchResults> {
  const all = await loadAllSummaries()
  const q = query.toLowerCase()
  const maxResults = limit ?? 20
  const results: AVSearchResult[] = []

  // First: search by first message
  for (const s of all) {
    if (results.length >= maxResults) break
    if (s.firstMessage.toLowerCase().includes(q)) {
      const idx = s.firstMessage.toLowerCase().indexOf(q)
      const start = Math.max(0, idx - 40)
      const end = Math.min(s.firstMessage.length, idx + q.length + 40)
      results.push({
        session_id: s.sessionId,
        project: s.projectFriendly,
        ordinal: 0,
        role: 'user',
        timestamp: s.startedAt,
        snippet: s.firstMessage.slice(start, end),
        rank: 1,
      })
    }
  }

  return { query, results }
}

export async function getSessionChildren(id: string): Promise<AVSessionListItem[]> {
  // JSONL sessions don't have parent-child relationships natively
  return []
}

/** Force re-parse all sessions (clear cache) */
export function clearAnalyticsCache(): void {
  summaryCache.clear()
}
