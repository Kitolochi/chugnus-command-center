import fs from 'fs'
import path from 'path'
import { Notification } from 'electron'
import {
  getAgents,
  getAgent,
  getAgentIssue,
  getAgentIssues,
  setAgentStatus,
  updateAgent,
  updateAgentIssue,
  createHeartbeatRun,
  updateHeartbeatRun,
  getHeartbeatRuns,
  createCostEvent,
  getCostEvents,
  appendAgentEvent,
  type Agent,
  type AgentIssue,
  type HeartbeatRun,
} from './database'
import { findSessionByPromptFragment, getSessionFilePath, isSessionComplete, extractSessionResult } from './cli-logs'

// Token pricing (per million tokens, in cents)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 1500, output: 7500 },
  'claude-sonnet-4-5-20250929': { input: 300, output: 1500 },
  'claude-haiku-4-5-20251001': { input: 80, output: 400 },
}

function estimateCostCents(inputTokens: number, outputTokens: number, model = 'claude-sonnet-4-5-20250929'): number {
  const pricing = TOKEN_PRICING[model] || TOKEN_PRICING['claude-sonnet-4-5-20250929']
  return Math.round((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000)
}

function getAgentConfig(taskType?: string): { preamble: string; allowedTools: string } {
  switch (taskType) {
    case 'research':
      return {
        preamble: 'You are a research specialist. Focus on gathering information, analyzing sources, and producing well-organized findings.',
        allowedTools: '"Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)" "Write(*)"',
      }
    case 'code':
      return {
        preamble: 'You are a software engineering specialist. Write clean, working code. Follow best practices and create production-ready implementations.',
        allowedTools: '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)"',
      }
    case 'writing':
      return {
        preamble: 'You are a writing specialist. Produce clear, well-structured content with appropriate tone.',
        allowedTools: '"Write(*)" "Edit(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    case 'planning':
      return {
        preamble: 'You are a strategic planning specialist. Create detailed, actionable plans with clear milestones.',
        allowedTools: '"Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    case 'communication':
      return {
        preamble: 'You are a communication specialist. Draft professional, clear communications.',
        allowedTools: '"Write(*)" "Edit(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    default:
      return {
        preamble: 'You are a capable AI assistant. Complete the assigned task thoroughly.',
        allowedTools: '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
  }
}

// --- Lifecycle stage helpers ---
type LifecycleStage = 'research' | 'development' | 'review' | 'committed' | 'pushed' | 'live'

const STAGE_ORDER: LifecycleStage[] = ['research', 'development', 'review', 'committed', 'pushed', 'live']

function stageIndex(stage: LifecycleStage): number {
  return STAGE_ORDER.indexOf(stage)
}

/** Assess the lifecycle stage of a completed run based on its structured result */
function assessStage(run: HeartbeatRun): LifecycleStage {
  const sr = run.structuredResult

  // Check for push signals in tool calls
  if (sr?.toolCalls?.some(t => t.tool === 'Bash' && t.count > 0)) {
    // If there are git commits AND the summary mentions push, consider it pushed
    if (sr?.gitCommits?.length && run.summary?.toLowerCase().includes('push')) {
      return 'pushed'
    }
  }

  // Has git commits → committed
  if (sr?.gitCommits && sr.gitCommits.length > 0) {
    return 'committed'
  }

  // Has test-related tool calls → review
  if (sr?.toolCalls?.some(t => ['Bash'].includes(t.tool))) {
    // Check if summary mentions tests
    if (run.summary?.toLowerCase().match(/\b(test|spec|lint|check)\b/)) {
      return 'review'
    }
  }

  // Has files changed → development
  if (sr?.filesChanged && sr.filesChanged.length > 0) {
    return 'development'
  }

  // Default → research
  return 'research'
}

/** Get stage-specific instruction suffix for the agent prompt */
function getStageInstructions(stage: LifecycleStage): string {
  switch (stage) {
    case 'research':
      return 'STAGE INSTRUCTIONS: Research the problem. Read relevant files and gather information. Do NOT make any code changes yet.'
    case 'development':
      return 'STAGE INSTRUCTIONS: Implement the changes. Write code, modify files, and build the solution.'
    case 'review':
      return 'STAGE INSTRUCTIONS: Review your changes. Run tests and linting. Fix any issues found. Ensure quality before committing.'
    case 'committed':
      return 'STAGE INSTRUCTIONS: Stage and commit your changes with a descriptive commit message following conventional commit format.'
    case 'pushed':
      return 'STAGE INSTRUCTIONS: Push committed changes to the remote repository.'
    case 'live':
      return 'STAGE INSTRUCTIONS: Verify the deployment is live and working correctly.'
  }
}

// --- Module-level launch function for retry support ---
type LaunchFn = (opts: { prompt: string; cwd: string; env: NodeJS.ProcessEnv; title?: string; allowedTools?: string }) => void
let storedLaunchFn: LaunchFn | null = null

/** Store the terminal launcher so pollAgentSessions can retry launches */
export function setLaunchFn(fn: LaunchFn): void {
  storedLaunchFn = fn
}

/** Complete a heartbeat run with auto-generated tags and status transitions */
export function completeRun(runId: string, updates: { status: HeartbeatRun['status']; summary?: string; durationMs?: number; inputTokens?: number; outputTokens?: number; costCents?: number; error?: string }): HeartbeatRun | null {
  const existingRun = getHeartbeatRuns().find(r => r.id === runId)
  if (!existingRun) return null

  // Auto-generate tags
  const tags: string[] = []
  const agent = getAgent(existingRun.agentId)
  if (agent) {
    if (agent.role && agent.role !== 'custom') tags.push(agent.role)
    if (agent.adapterConfig?.taskType) tags.push(agent.adapterConfig.taskType)
  }
  if (['succeeded', 'failed', 'timed_out'].includes(updates.status)) {
    tags.push(updates.status === 'timed_out' ? 'timed-out' : updates.status)
  }
  if (existingRun.issueId) {
    const issue = getAgentIssue(existingRun.issueId)
    if (issue?.priority) tags.push(issue.priority)
  }
  tags.push(existingRun.source)

  const run = updateHeartbeatRun(runId, {
    ...updates,
    completedAt: new Date().toISOString(),
    tags: tags.length > 0 ? tags : undefined,
  })

  if (run) {
    // Reset agent to idle
    if (agent && agent.status === 'running') {
      setAgentStatus(agent.id, 'idle')
    }
    // Move issue to in_review on success (unless auto-loop will handle it)
    if (run.issueId && updates.status === 'succeeded') {
      const iss = getAgentIssue(run.issueId)
      if (!iss?.targetStage) {
        updateAgentIssue(run.issueId, { status: 'in_review', result: updates.summary })
      }
    }

    // Cooldown tracking
    if (agent) {
      if (updates.status === 'failed' || updates.status === 'timed_out') {
        const failures = (agent.consecutiveFailures || 0) + 1
        const cooldownMinutes = Math.min(240, failures * failures * 15)
        const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60000).toISOString()
        updateAgent(agent.id, { consecutiveFailures: failures, cooldownUntil: failures >= 3 ? cooldownUntil : undefined })
        appendAgentEvent({ agentId: agent.id, runId: run.id, issueId: run.issueId, type: 'fail', detail: updates.error || `Run ${updates.status}` })
        if (failures >= 3) {
          appendAgentEvent({ agentId: agent.id, runId: run.id, type: 'cooldown', detail: `Cooldown ${cooldownMinutes}m after ${failures} consecutive failures` })
        }

        // Escalation logic
        if (run.issueId) {
          const iss = getAgentIssue(run.issueId)
          if (iss) {
            const newLevel = (iss.escalationLevel || 0) + 1
            updateAgentIssue(run.issueId, { escalationLevel: newLevel, escalatedAt: new Date().toISOString() })
            if (newLevel >= 3) {
              updateAgentIssue(run.issueId, { status: 'blocked' })
              new Notification({
                title: `Issue Escalated: ${iss.title}`,
                body: `Escalation level ${newLevel} — issue blocked after repeated failures`,
              }).show()
              appendAgentEvent({ agentId: agent.id, runId: run.id, issueId: run.issueId, type: 'escalation', detail: `Level ${newLevel} — issue blocked` })
            } else if (newLevel === 2) {
              new Notification({
                title: `Issue Escalation Warning: ${iss.title}`,
                body: `Escalation level ${newLevel} — one more failure will block this issue`,
              }).show()
              appendAgentEvent({ agentId: agent.id, runId: run.id, issueId: run.issueId, type: 'escalation', detail: `Level ${newLevel} — warning` })
            }
          }
        }
      } else if (updates.status === 'succeeded') {
        updateAgent(agent.id, { consecutiveFailures: 0, cooldownUntil: undefined })
        appendAgentEvent({ agentId: agent.id, runId: run.id, issueId: run.issueId, type: 'complete', detail: updates.summary?.slice(0, 200) || 'Run completed successfully' })
        // Reset escalation on success
        if (run.issueId) {
          updateAgentIssue(run.issueId, { escalationLevel: 0, escalatedAt: undefined })
        }
      }
    }
  }

  return run
}

/** Requeue an issue back to todo so it can be picked up again */
export function requeueIssue(issueId: string): void {
  const issue = getAgentIssue(issueId)
  if (!issue) return
  // Skip requeue if escalated to level 3+ (blocked)
  if ((issue.escalationLevel || 0) >= 3) return
  updateAgentIssue(issueId, {
    status: 'todo',
    checkedOutAt: undefined,
    checkedOutRunId: undefined,
  })
  if (issue.assignedAgentId) {
    appendAgentEvent({ agentId: issue.assignedAgentId, issueId, type: 'requeue', detail: `Issue "${issue.title}" requeued to todo` })
  }
}

/** Show a desktop notification when an agent hits its budget threshold */
export function emitBudgetAlert(agent: Agent, ratio: number): void {
  const pct = Math.round(ratio * 100)
  new Notification({
    title: `Agent Budget Alert: ${agent.name}`,
    body: `${pct}% of monthly budget used ($${(agent.spentMonthlyCents / 100).toFixed(2)} / $${(agent.budgetMonthlyCents / 100).toFixed(2)}). Agent paused.`,
  }).show()
  appendAgentEvent({ agentId: agent.id, type: 'budget_alert', detail: `${pct}% budget used — agent paused` })
}

/** Check if an agent's heartbeat is due (mirrors isRoutineDue logic from routines.ts) */
export function isAgentHeartbeatDue(agent: Agent): boolean {
  if (agent.status === 'paused') return false
  if (!agent.heartbeat?.enabled) return false
  if (agent.status === 'running') return false
  if (agent.cooldownUntil && new Date(agent.cooldownUntil) > new Date()) return false

  const now = new Date()
  const { schedule, lastRun } = agent.heartbeat

  switch (schedule.trigger) {
    case 'interval': {
      const mins = schedule.intervalMinutes || 60
      if (!lastRun) return true
      const elapsed = (now.getTime() - new Date(lastRun).getTime()) / 60000
      return elapsed >= mins
    }
    case 'daily': {
      const today = now.toISOString().split('T')[0]
      if (lastRun && lastRun.split('T')[0] === today) return false
      if (schedule.time) {
        const [h, m] = schedule.time.split(':').map(Number)
        const nowMinutes = now.getHours() * 60 + now.getMinutes()
        return nowMinutes >= h * 60 + m
      }
      return true
    }
    case 'weekly': {
      const today = now.toISOString().split('T')[0]
      if (lastRun && lastRun.split('T')[0] === today) return false
      const targetDay = schedule.dayOfWeek ?? 1
      if (now.getDay() !== targetDay) return false
      if (schedule.time) {
        const [h, m] = schedule.time.split(':').map(Number)
        const nowMinutes = now.getHours() * 60 + now.getMinutes()
        return nowMinutes >= h * 60 + m
      }
      return true
    }
    default:
      return false
  }
}

/** Find the next todo issue assigned to an agent and check it out */
export function checkoutNextIssue(agentId: string): AgentIssue | null {
  const allIssues = getAgentIssues({ agentId, status: 'todo' })
  // Filter out issues with unresolved blockedBy dependencies
  const issues = allIssues.filter(issue => {
    if (!issue.blockedBy?.length) return true
    return issue.blockedBy.every(depId => {
      const dep = getAgentIssue(depId)
      return dep?.status === 'done'
    })
  })
  if (issues.length === 0) return null
  // issues already sorted by priority from getAgentIssues
  const issue = issues[0]
  const now = new Date().toISOString()
  updateAgentIssue(issue.id, {
    status: 'in_progress',
    checkedOutAt: now,
  })
  return { ...issue, status: 'in_progress', checkedOutAt: now }
}

/** Build the prompt for an agent heartbeat */
function buildAgentPrompt(agent: Agent, issue?: AgentIssue | null): string {
  const config = agent.adapterConfig
  const agentConfig = getAgentConfig(config.taskType)
  const preamble = config.preamble || agentConfig.preamble
  const cwd = config.cwd || process.cwd()

  const parts: string[] = [preamble, '']

  parts.push(`[Agent: ${agent.name} | Role: ${agent.role}]`)
  parts.push('')

  // Inject shared context file if it exists
  const contextPath = path.join(cwd, '.agent-context.md')
  try {
    if (fs.existsSync(contextPath)) {
      const ctx = fs.readFileSync(contextPath, 'utf-8').slice(0, 4000)
      parts.push('SHARED CONTEXT (from .agent-context.md):')
      parts.push(ctx)
      parts.push('')
    }
  } catch {}

  if (issue) {
    parts.push(`ASSIGNED ISSUE: ${issue.title}`)
    if (issue.description) parts.push(`DESCRIPTION: ${issue.description}`)
    parts.push(`PRIORITY: ${issue.priority}`)
    if (issue.estimatedComplexity) parts.push(`COMPLEXITY: ${issue.estimatedComplexity}`)
    if (issue.tags.length > 0) parts.push(`TAGS: ${issue.tags.join(', ')}`)

    // Handoff: inject prior run context if available
    const priorRuns = getHeartbeatRuns({ issueId: issue.id })
    const priorSucceeded = priorRuns.find(r => r.status === 'succeeded' && r.id !== issue.checkedOutRunId)
    const priorFailed = priorRuns.find(r => (r.status === 'failed' || r.status === 'timed_out') && r.checkpoint)
    if (priorSucceeded) {
      parts.push('')
      parts.push('PRIOR RUN CONTEXT (succeeded):')
      if (priorSucceeded.summary) parts.push(`Summary: ${priorSucceeded.summary.slice(0, 500)}`)
      if (priorSucceeded.structuredResult?.filesChanged?.length) {
        parts.push(`Files changed: ${priorSucceeded.structuredResult.filesChanged.join(', ')}`)
      }
      if (priorSucceeded.structuredResult?.gitCommits?.length) {
        parts.push(`Commits: ${priorSucceeded.structuredResult.gitCommits.join('; ')}`)
      }
    } else if (priorFailed?.checkpoint) {
      parts.push('')
      parts.push('PRIOR RUN CONTEXT (failed — continue from where it left off):')
      if (priorFailed.checkpoint.partialSummary) parts.push(`Partial progress: ${priorFailed.checkpoint.partialSummary}`)
      if (priorFailed.checkpoint.filesChanged?.length) {
        parts.push(`Files touched: ${priorFailed.checkpoint.filesChanged.join(', ')}`)
      }
    }

    // Deliverables as acceptance criteria
    if (issue.deliverables && issue.deliverables.length > 0) {
      parts.push('')
      parts.push('ACCEPTANCE CRITERIA / DELIVERABLES:')
      issue.deliverables.forEach((d, i) => parts.push(`  ${i + 1}. ${d}`))
    }

    // Lifecycle stage context
    if (issue.stage && issue.targetStage) {
      parts.push('')
      parts.push(`LIFECYCLE: Stage ${issue.stage} → target ${issue.targetStage} | Iteration ${(issue.iteration || 0) + 1}/${issue.maxIterations || 5}`)
      parts.push(getStageInstructions(issue.stage))
    } else {
      parts.push('')
      parts.push('Please work on this issue autonomously. Read relevant files, implement changes, and verify your work.')
    }

    parts.push('When done, provide a brief summary of what you accomplished.')
    parts.push('Update `.agent-context.md` with key findings for the next agent run.')
  } else {
    parts.push('No specific issue assigned. Check your working directory for any pending work or improvements to make.')
  }

  return parts.join('\n')
}

/** Execute a heartbeat for an agent — launches external terminal with Claude Code */
export function executeAgentHeartbeat(
  agent: Agent,
  issue?: AgentIssue | null,
  source: HeartbeatRun['source'] = 'timer',
  launchFn?: (opts: { prompt: string; cwd: string; env: NodeJS.ProcessEnv; title?: string; allowedTools?: string }) => void
): HeartbeatRun {
  const prompt = buildAgentPrompt(agent, issue)
  const config = agent.adapterConfig
  const agentConfig = getAgentConfig(config.taskType)
  const allowedTools = config.allowedTools || agentConfig.allowedTools
  const cwd = config.cwd || process.cwd()
  const now = new Date().toISOString()

  // Find prior run for the same issue to set parentRunId (handoff chain)
  let parentRunId: string | undefined
  if (issue) {
    const priorRuns = getHeartbeatRuns({ issueId: issue.id })
    const priorSucceeded = priorRuns.find(r => r.status === 'succeeded')
    if (priorSucceeded) parentRunId = priorSucceeded.id
  }

  // Create the heartbeat run record
  const run = createHeartbeatRun({
    agentId: agent.id,
    issueId: issue?.id,
    source,
    status: 'running',
    prompt,
    startedAt: now,
    parentRunId,
    iteration: issue?.iteration,
  })

  // Update issue with run reference
  if (issue) {
    updateAgentIssue(issue.id, { checkedOutRunId: run.id })
  }

  // Update agent status
  updateAgent(agent.id, {
    status: 'running',
    heartbeat: {
      ...agent.heartbeat!,
      lastRun: now,
    },
  })

  // Emit launch event
  appendAgentEvent({ agentId: agent.id, runId: run.id, issueId: issue?.id, type: 'launch', detail: issue ? `Working on: ${issue.title}` : 'Heartbeat run (no issue)' })

  // Launch in external terminal
  if (launchFn) {
    try {
      launchFn({
        prompt,
        cwd,
        env: process.env,
        title: `Agent: ${agent.name}`,
        allowedTools,
      })
    } catch (err: any) {
      const retryCount = 0
      if (retryCount < 3) {
        const backoffSeconds = [30, 60, 120][retryCount]
        const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000).toISOString()
        updateHeartbeatRun(run.id, {
          status: 'queued',
          retryCount: retryCount + 1,
          nextRetryAt,
          error: err.message,
        })
        // Keep agent as 'running' to block new heartbeats during retry
      } else {
        updateHeartbeatRun(run.id, {
          status: 'failed',
          error: err.message,
          completedAt: new Date().toISOString(),
        })
        updateAgent(agent.id, { status: 'error', lastError: err.message })
        if (issue) requeueIssue(issue.id)
      }
      appendAgentEvent({ agentId: agent.id, runId: run.id, type: 'fail', detail: `Launch failed: ${err.message}` })
    }
  }

  return run
}

/** Run all due agent heartbeats */
export function runDueAgentHeartbeats(
  launchFn?: (opts: { prompt: string; cwd: string; env: NodeJS.ProcessEnv; title?: string; allowedTools?: string }) => void
): HeartbeatRun[] {
  const MAX_CONCURRENT_RUNS = 2
  const allAgents = getAgents()
  const runningCount = allAgents.filter(a => a.status === 'running').length
  let availableSlots = MAX_CONCURRENT_RUNS - runningCount
  if (availableSlots <= 0) return []

  // Filter to due agents
  const dueAgents = allAgents.filter(a => isAgentHeartbeatDue(a))

  // Sort by highest-priority todo issue (critical=0, high=1, medium=2, low=3)
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  dueAgents.sort((a, b) => {
    const aIssues = getAgentIssues({ agentId: a.id, status: 'todo' })
    const bIssues = getAgentIssues({ agentId: b.id, status: 'todo' })
    const aPrio = aIssues.length > 0 ? (priorityOrder[aIssues[0].priority] ?? 2) : 4
    const bPrio = bIssues.length > 0 ? (priorityOrder[bIssues[0].priority] ?? 2) : 4
    return aPrio - bPrio
  })

  const results: HeartbeatRun[] = []

  for (const agent of dueAgents) {
    if (availableSlots <= 0) break

    // Check budget — pause at 80% threshold with desktop notification
    if (agent.budgetMonthlyCents > 0) {
      const ratio = agent.spentMonthlyCents / agent.budgetMonthlyCents
      if (ratio >= 0.8 && agent.status !== 'paused') {
        updateAgent(agent.id, { status: 'paused' })
        emitBudgetAlert(agent, ratio)
        continue
      }
      if (agent.spentMonthlyCents >= agent.budgetMonthlyCents) {
        continue
      }
    }

    // Try to check out an issue
    const issue = checkoutNextIssue(agent.id)
    const run = executeAgentHeartbeat(agent, issue, 'timer', launchFn)
    results.push(run)
    availableSlots--
  }

  return results
}

/** Poll running agent sessions to detect completion. Returns true if any state changed. */
export async function pollAgentSessions(): Promise<boolean> {
  let changed = false
  const allRuns = getHeartbeatRuns()

  // Part A: Retry processing — re-attempt queued runs whose backoff has elapsed
  const retryRuns = allRuns.filter(r => r.status === 'queued' && r.nextRetryAt && r.nextRetryAt <= new Date().toISOString())
  for (const run of retryRuns) {
    try {
      if (!storedLaunchFn) continue
      const agent = getAgent(run.agentId)
      if (!agent) continue
      const config = agent.adapterConfig
      const agentConfig = getAgentConfig(config.taskType)
      const allowedTools = config.allowedTools || agentConfig.allowedTools
      const cwd = config.cwd || process.cwd()

      storedLaunchFn({
        prompt: run.prompt,
        cwd,
        env: process.env,
        title: `Agent: ${agent.name} (retry)`,
        allowedTools,
      })
      updateHeartbeatRun(run.id, { status: 'running', error: undefined })
      changed = true
    } catch (err: any) {
      const retryCount = run.retryCount || 0
      if (retryCount < 3) {
        const backoffSeconds = [30, 60, 120][Math.min(retryCount, 2)]
        updateHeartbeatRun(run.id, {
          retryCount: retryCount + 1,
          nextRetryAt: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
          error: err.message,
        })
      } else {
        completeRun(run.id, { status: 'failed', error: `Launch failed after ${retryCount} retries: ${err.message}` })
        if (run.issueId) requeueIssue(run.issueId)
      }
      changed = true
    }
  }

  // Part B & C: Check running runs for auto-complete and timeout
  const runningRuns = allRuns.filter(r => r.status === 'running')
  for (const run of runningRuns) {
    try {
      // Try to find the session by looking for the prompt fragment
      if (!run.sessionId) {
        const fragment = run.prompt.slice(0, 80)
        const sessionId = await findSessionByPromptFragment(fragment, run.startedAt)
        if (sessionId) {
          updateHeartbeatRun(run.id, { sessionId })
          run.sessionId = sessionId
          changed = true
        }
      }

      // Part B: Auto-complete — detect finished sessions
      if (run.sessionId) {
        const filePath = getSessionFilePath(run.sessionId)
        if (filePath && isSessionComplete(filePath)) {
          const result = await extractSessionResult(filePath)
          const elapsed = Date.now() - new Date(run.startedAt).getTime()

          if (result.totalInputTokens > 0 || result.summary) {
            const costCents = estimateCostCents(result.totalInputTokens, result.totalOutputTokens, result.model)
            completeRun(run.id, {
              status: 'succeeded',
              summary: result.summary,
              durationMs: elapsed,
              inputTokens: result.totalInputTokens,
              outputTokens: result.totalOutputTokens,
              costCents,
            })

            // Apply structured result
            updateHeartbeatRun(run.id, {
              structuredResult: {
                filesChanged: result.filesChanged,
                toolCalls: result.toolCalls,
                gitCommits: result.gitCommits,
              },
            })

            // Create cost event
            createCostEvent({
              agentId: run.agentId,
              issueId: run.issueId,
              heartbeatRunId: run.id,
              source: 'heartbeat',
              provider: 'anthropic',
              model: result.model || 'claude-sonnet-4-5-20250929',
              inputTokens: result.totalInputTokens,
              outputTokens: result.totalOutputTokens,
              costCents,
              timestamp: new Date().toISOString(),
            })

            // Re-aggregate costs and check budget threshold
            aggregateAgentCosts(run.agentId)
            const agent = getAgent(run.agentId)
            if (agent && agent.budgetMonthlyCents > 0) {
              const ratio = agent.spentMonthlyCents / agent.budgetMonthlyCents
              if (ratio >= 0.8 && agent.status !== 'paused') {
                updateAgent(agent.id, { status: 'paused' })
                emitBudgetAlert(agent, ratio)
              }
            }

            // --- Auto-relaunch logic ---
            if (run.issueId) {
              const issue = getAgentIssue(run.issueId)
              if (issue?.targetStage && agent) {
                // Re-read the run with structuredResult attached
                const completedRun = getHeartbeatRuns().find(r => r.id === run.id)
                const assessed = completedRun ? assessStage(completedRun) : 'research'
                const iteration = (issue.iteration || 0) + 1
                const maxIter = issue.maxIterations || 5
                const targetReached = stageIndex(assessed) >= stageIndex(issue.targetStage)

                // Update issue stage and iteration
                updateAgentIssue(issue.id, { stage: assessed, iteration })

                if (targetReached || iteration >= maxIter) {
                  // Target reached or max iterations — move to in_review
                  updateAgentIssue(issue.id, { status: 'in_review', result: result.summary })
                  appendAgentEvent({
                    agentId: run.agentId, runId: run.id, issueId: issue.id,
                    type: 'auto_relaunch',
                    detail: targetReached
                      ? `Target stage '${issue.targetStage}' reached at iteration ${iteration} (assessed: ${assessed})`
                      : `Max iterations (${maxIter}) reached at stage '${assessed}'`,
                  })
                } else {
                  // Determine next stage for instructions
                  const nextStageIdx = Math.min(stageIndex(assessed) + 1, STAGE_ORDER.length - 1)
                  const nextStage = STAGE_ORDER[nextStageIdx]
                  updateAgentIssue(issue.id, { stage: nextStage })

                  // Budget check before relaunch
                  const freshAgent = getAgent(run.agentId)
                  if (freshAgent && freshAgent.status !== 'paused' && freshAgent.budgetMonthlyCents > 0) {
                    const budgetRatio = freshAgent.spentMonthlyCents / freshAgent.budgetMonthlyCents
                    if (budgetRatio >= 0.8) {
                      updateAgentIssue(issue.id, { status: 'in_review', result: `Budget limit reached at iteration ${iteration}` })
                      appendAgentEvent({ agentId: run.agentId, issueId: issue.id, type: 'auto_relaunch', detail: `Budget limit — stopping auto-loop at stage '${nextStage}'` })
                      changed = true
                      continue
                    }
                  }

                  appendAgentEvent({
                    agentId: run.agentId, runId: run.id, issueId: issue.id,
                    type: 'auto_relaunch',
                    detail: `Auto-relaunch: stage ${assessed} → ${nextStage} (iteration ${iteration}/${maxIter})`,
                  })

                  // Schedule relaunch after 5s delay
                  const relaunchAgent = freshAgent || agent
                  const relaunchIssue = getAgentIssue(issue.id)!
                  if (storedLaunchFn && relaunchIssue) {
                    setTimeout(() => {
                      try {
                        executeAgentHeartbeat(relaunchAgent, relaunchIssue, 'assignment', storedLaunchFn!)
                      } catch (err: any) {
                        console.error(`[agents] Auto-relaunch failed for issue ${issue.id}:`, err)
                      }
                    }, 5000)
                  }
                }
              }
            }
          } else {
            // Session complete but no output — save checkpoint and mark failed
            updateHeartbeatRun(run.id, {
              checkpoint: {
                partialSummary: result.summary?.slice(0, 500) || undefined,
                filesChanged: result.filesChanged,
                toolCallCount: result.toolCalls?.reduce((s, t) => s + t.count, 0),
              },
            })
            completeRun(run.id, { status: 'failed', durationMs: elapsed, error: 'Session completed with no output' })
            if (run.issueId) requeueIssue(run.issueId)
          }
          changed = true
          continue
        }
      }

      // Part C: Timeout requeue — complexity-based limit (S=1h, M=2h, L=4h)
      const elapsed = Date.now() - new Date(run.startedAt).getTime()
      const timeoutIssue = run.issueId ? getAgentIssue(run.issueId) : null
      const complexityTimeouts: Record<string, number> = { S: 1, M: 2, L: 4 }
      const timeoutHours = complexityTimeouts[timeoutIssue?.estimatedComplexity || 'M'] || 2
      if (elapsed > timeoutHours * 60 * 60 * 1000) {
        // Save checkpoint from partial session data
        if (run.sessionId) {
          const filePath = getSessionFilePath(run.sessionId)
          if (filePath) {
            try {
              const partialResult = await extractSessionResult(filePath)
              updateHeartbeatRun(run.id, {
                checkpoint: {
                  partialSummary: partialResult.summary?.slice(0, 500),
                  filesChanged: partialResult.filesChanged,
                  toolCallCount: partialResult.toolCalls?.reduce((s, t) => s + t.count, 0),
                },
              })
            } catch {}
          }
        }
        completeRun(run.id, {
          status: 'timed_out',
          durationMs: elapsed,
        })
        if (run.issueId) requeueIssue(run.issueId)
        changed = true
      }
    } catch (err) {
      console.error(`[agents] Poll error for run ${run.id}:`, err)
    }
  }

  return changed
}

/** Aggregate cost events for an agent and update spentMonthlyCents */
export function aggregateAgentCosts(agentId: string): void {
  const agent = getAgent(agentId)
  if (!agent) return

  const firstOfMonth = new Date().toISOString().slice(0, 8) + '01'

  // Reset budget if new month
  if (agent.budgetResetDate !== firstOfMonth) {
    updateAgent(agentId, { budgetResetDate: firstOfMonth, spentMonthlyCents: 0 })
    return
  }

  const events = getCostEvents({ agentId })
  const monthEvents = events.filter(e => e.timestamp >= firstOfMonth)
  const monthCents = monthEvents.reduce((sum, e) => sum + e.costCents, 0)

  updateAgent(agentId, { spentMonthlyCents: monthCents })
}

export { estimateCostCents, getAgentConfig as getAgentConfigForType }
