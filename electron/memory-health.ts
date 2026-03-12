import { getMemories, archiveMemory, getMemorySettings } from './database'

// --- Types ---

export interface MemoryHealth {
  totalMemories: number
  totalTokens: number
  tokenBudget: number
  budgetUsagePercent: number
  status: 'healthy' | 'warning' | 'critical'
  staleMemoryCount: number
  recommendation: string
}

// --- Helpers ---

/** Rough token estimate: ~4 chars per token for English text */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** A memory is considered stale if it hasn't been updated in 90 days and has low importance */
function isStale(memory: { updatedAt: string; importance: number }): boolean {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
  return memory.importance === 1 && new Date(memory.updatedAt).getTime() < ninetyDaysAgo
}

// --- Core Functions ---

export function getMemoryHealth(): MemoryHealth {
  const memories = getMemories()
  const settings = getMemorySettings()

  const totalTokens = memories.reduce((sum, m) => {
    return sum + estimateTokens(m.title) + estimateTokens(m.content)
  }, 0)

  const tokenBudget = settings.tokenBudget
  const budgetUsagePercent = tokenBudget > 0 ? parseFloat(((totalTokens / tokenBudget) * 100).toFixed(1)) : 0
  const staleMemoryCount = memories.filter(m => isStale(m)).length

  let status: MemoryHealth['status']
  let recommendation: string

  if (budgetUsagePercent < 70) {
    status = 'healthy'
    recommendation = 'Memory usage is within budget. No action needed.'
  } else if (budgetUsagePercent < 90) {
    status = 'warning'
    recommendation = staleMemoryCount > 0
      ? `Consider archiving ${staleMemoryCount} stale memories or running knowledge compression.`
      : 'Approaching token budget. Consider compressing knowledge or increasing the budget.'
  } else {
    status = 'critical'
    recommendation = `Over budget! Archive low-importance memories or compress knowledge immediately. ${staleMemoryCount} stale memories can be auto-pruned.`
  }

  return {
    totalMemories: memories.length,
    totalTokens,
    tokenBudget,
    budgetUsagePercent,
    status,
    staleMemoryCount,
    recommendation,
  }
}

/**
 * Auto-prune memories by archiving lowest-importance, oldest memories
 * until token usage drops below 70% of budget.
 * Returns the number of memories archived.
 */
export function autoPrune(): number {
  const memories = getMemories()
  const settings = getMemorySettings()
  const targetTokens = settings.tokenBudget * 0.7

  // Calculate current token total
  let currentTokens = memories.reduce((sum, m) => {
    return sum + estimateTokens(m.title) + estimateTokens(m.content)
  }, 0)

  if (currentTokens <= targetTokens) return 0

  // Sort: low importance first, then oldest first. Never prune pinned.
  const candidates = memories
    .filter(m => !m.isPinned)
    .sort((a, b) => {
      if (a.importance !== b.importance) return a.importance - b.importance
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    })

  let archived = 0

  for (const mem of candidates) {
    if (currentTokens <= targetTokens) break
    const memTokens = estimateTokens(mem.title) + estimateTokens(mem.content)
    archiveMemory(mem.id)
    currentTokens -= memTokens
    archived++
  }

  return archived
}

// --- Health Monitor ---

let monitorInterval: ReturnType<typeof setInterval> | null = null
let lastStatus: MemoryHealth['status'] | null = null

export function startHealthMonitor(
  intervalMs: number,
  onHealthChange: (health: MemoryHealth) => void
): void {
  stopHealthMonitor()

  const check = () => {
    const health = getMemoryHealth()
    if (health.status !== lastStatus) {
      lastStatus = health.status
      onHealthChange(health)
    }
  }

  check()
  monitorInterval = setInterval(check, intervalMs)
}

export function stopHealthMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval)
    monitorInterval = null
  }
  lastStatus = null
}
