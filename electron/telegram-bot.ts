import TelegramBot from 'node-telegram-bot-api'
import { getChatSettings, getBriefingData, getRoadmapGoals, getMasterPlanTasks, getRecentNotes, getMasterPlan } from './database'
import { getRelevantMemories } from './memory'
import { search } from './vector-store'
import { callLLM } from './llm'
import { getCompressedOverview, getRelevantDomainSummaries, adaptiveRagBudget, deduplicateRagAgainstDomains, ScoredDomain } from './compressor'
import { getQueue, launchProcess, getProcessCount } from './command-center'

// --- Types ---

export interface TelegramSettings {
  botToken: string
  authorizedChatId: string
  enabled: boolean
}

// --- State ---

let bot: TelegramBot | null = null
let settings: TelegramSettings = { botToken: '', authorizedChatId: '', enabled: false }

// --- Auth guard ---

function isAuthorized(chatId: number): boolean {
  return String(chatId) === settings.authorizedChatId
}

function unauthorized(chatId: number) {
  bot?.sendMessage(chatId, 'Unauthorized. Your chat ID: `' + chatId + '`', { parse_mode: 'Markdown' })
}

// --- Smart query (non-streaming, reuses same RAG pipeline as the UI) ---

async function runSmartQuery(query: string): Promise<string> {
  const compressedOverview = getCompressedOverview()
  let domainSummariesContext = ''
  let scoredDomains: ScoredDomain[] = []
  try {
    scoredDomains = await getRelevantDomainSummaries(query, 3)
    if (scoredDomains.length > 0) {
      domainSummariesContext = scoredDomains.map(sd =>
        `### ${sd.domain.label}\n${sd.domain.summary}\nKey facts:\n${sd.domain.facts.map(f => '- ' + f).join('\n')}`
      ).join('\n\n')
    }
  } catch {}

  const ragBudget = adaptiveRagBudget(scoredDomains)
  let ragContext = ''
  try {
    const ragResults = await search(query, { topK: ragBudget })
    if (ragResults && ragResults.length > 0) {
      if (scoredDomains.length > 0) {
        const keep = await deduplicateRagAgainstDomains(
          ragResults.map(r => r.text),
          scoredDomains
        )
        const filtered = ragResults.filter((_, i) => keep[i])
        ragContext = filtered.map(r => `[${r.domain}/${r.heading}] ${r.text.slice(0, 300)}`).join('\n')
      } else {
        ragContext = ragResults.map(r => `[${r.domain}/${r.heading}] ${r.text.slice(0, 300)}`).join('\n')
      }
    }
  } catch {}

  const memories = getRelevantMemories(query, [], 15, 2000)
  const memoryContext = memories.map(m => `- [${m.topics.join(', ')}] ${m.title}: ${m.content}`).join('\n')

  const goals = getRoadmapGoals()
  const goalsContext = goals.map(g => {
    const tasks = getMasterPlanTasks(`goal-${g.id}`)
    const completed = tasks.filter(t => t.status === 'completed').length
    const total = tasks.length
    const progress = total > 0 ? ` (${completed}/${total} tasks done)` : ''
    return `- [${g.category}/${g.priority}] ${g.title}${progress} — ${g.status}`
  }).join('\n')

  const briefing = getBriefingData()
  const activityContext = [
    `Current streak: ${briefing.streak} days`,
    `Tasks completed this week: ${briefing.stats.tasksCompletedThisWeek}`,
    briefing.overdueTasks.length > 0 ? `Overdue: ${briefing.overdueTasks.map((t: any) => t.title).join(', ')}` : null,
    briefing.todayTasks.length > 0 ? `Due today: ${briefing.todayTasks.map((t: any) => t.title).join(', ')}` : null,
    briefing.highPriorityTasks.length > 0 ? `High priority: ${briefing.highPriorityTasks.map((t: any) => t.title).join(', ')}` : null,
  ].filter(Boolean).join('\n')

  const recentNotes = getRecentNotes(5)
  const journalContext = recentNotes.map(n => `${n.date}: ${n.content.slice(0, 200)}`).join('\n')

  const masterPlan = getMasterPlan()
  const planContext = masterPlan ? masterPlan.content.slice(0, 2000) : '(No master plan generated yet)'

  const today = new Date().toISOString().split('T')[0]
  const systemPrompt = `You are Chugnus, a personal AI assistant replying via Telegram. Today is ${today}.
Keep responses concise (under 2000 chars) since this is a mobile chat. Use Telegram markdown formatting.

## Goals
${goalsContext || '(No goals set)'}

## Activity
${activityContext}

## Recent Journal
${journalContext || '(No recent entries)'}

## Master Plan
${planContext}
${compressedOverview ? `\n## Knowledge Overview\n${compressedOverview}` : ''}${domainSummariesContext ? `\n## Domain Details\n${domainSummariesContext}` : ''}

## Memories
${memoryContext || '(No relevant memories)'}

## RAG Context
${ragContext || '(No relevant documents)'}

Be specific, cite actual goals/tasks/memories by name. Be actionable.`

  const chatSettings = getChatSettings()
  return callLLM({
    messages: [{ role: 'user', content: query }],
    system: systemPrompt,
    model: chatSettings.model,
    maxTokens: 1500,
    tier: 'chat',
  })
}

// --- Command handlers ---

function registerCommands() {
  if (!bot) return

  bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg.chat.id)) return unauthorized(msg.chat.id)
    bot!.sendMessage(msg.chat.id, [
      '*Chugnus Command Center* connected',
      '',
      '/status — Queue & activity overview',
      '/goals — Current goals & progress',
      '/queue — Running CLI sessions',
      '/ask <question> — Smart query (RAG)',
      '',
      'Or send any message to query.',
    ].join('\n'), { parse_mode: 'Markdown' })
  })

  bot.onText(/\/status/, async (msg) => {
    if (!isAuthorized(msg.chat.id)) return unauthorized(msg.chat.id)
    try {
      const briefing = getBriefingData()
      const queue = getQueue()
      const running = queue.filter(q => q.status === 'working').length
      const awaiting = queue.filter(q => q.status === 'awaiting_input').length

      const lines = [
        `*Status* — ${new Date().toLocaleDateString()}`,
        `Streak: ${briefing.streak} days`,
        `Tasks done this week: ${briefing.stats.tasksCompletedThisWeek}`,
        `CLI sessions: ${running} running, ${awaiting} awaiting input`,
      ]
      if (briefing.overdueTasks.length > 0) {
        lines.push(`Overdue: ${briefing.overdueTasks.map((t: any) => t.title).join(', ')}`)
      }
      if (briefing.todayTasks.length > 0) {
        lines.push(`Due today: ${briefing.todayTasks.map((t: any) => t.title).join(', ')}`)
      }
      bot!.sendMessage(msg.chat.id, lines.join('\n'), { parse_mode: 'Markdown' })
    } catch (err: any) {
      bot!.sendMessage(msg.chat.id, `Error: ${err.message}`)
    }
  })

  bot.onText(/\/goals/, (msg) => {
    if (!isAuthorized(msg.chat.id)) return unauthorized(msg.chat.id)
    try {
      const goals = getRoadmapGoals()
      if (goals.length === 0) {
        bot!.sendMessage(msg.chat.id, 'No goals set.')
        return
      }
      const lines = goals.map(g => {
        const tasks = getMasterPlanTasks(`goal-${g.id}`)
        const completed = tasks.filter(t => t.status === 'completed').length
        const total = tasks.length
        const bar = total > 0 ? ` [${completed}/${total}]` : ''
        return `${g.status === 'completed' ? '~~' : ''}• *${g.title}*${bar} — ${g.status}${g.status === 'completed' ? '~~' : ''}`
      })
      bot!.sendMessage(msg.chat.id, `*Goals*\n${lines.join('\n')}`, { parse_mode: 'Markdown' })
    } catch (err: any) {
      bot!.sendMessage(msg.chat.id, `Error: ${err.message}`)
    }
  })

  bot.onText(/\/queue/, (msg) => {
    if (!isAuthorized(msg.chat.id)) return unauthorized(msg.chat.id)
    try {
      const queue = getQueue()
      if (queue.length === 0) {
        bot!.sendMessage(msg.chat.id, 'No active CLI sessions.')
        return
      }
      const lines = queue.map(q => {
        const elapsed = Math.round((Date.now() - q.startedAt) / 60000)
        const cost = q.costUsd > 0 ? ` $${q.costUsd.toFixed(2)}` : ''
        return `• *${q.projectName}* [${q.status}] ${elapsed}m${cost}\n  _${q.prompt.slice(0, 80)}_`
      })
      bot!.sendMessage(msg.chat.id, `*Queue* (${queue.length})\n${lines.join('\n')}`, { parse_mode: 'Markdown' })
    } catch (err: any) {
      bot!.sendMessage(msg.chat.id, `Error: ${err.message}`)
    }
  })

  bot.onText(/\/ask (.+)/, async (msg, match) => {
    if (!isAuthorized(msg.chat.id)) return unauthorized(msg.chat.id)
    const query = match?.[1]
    if (!query) return
    bot!.sendChatAction(msg.chat.id, 'typing')
    try {
      const answer = await runSmartQuery(query)
      // Telegram has a 4096 char limit per message
      const trimmed = answer.length > 4000 ? answer.slice(0, 4000) + '...' : answer
      bot!.sendMessage(msg.chat.id, trimmed, { parse_mode: 'Markdown' }).catch(() => {
        // Fallback without markdown if parsing fails
        bot!.sendMessage(msg.chat.id, trimmed)
      })
    } catch (err: any) {
      bot!.sendMessage(msg.chat.id, `Query failed: ${err.message}`)
    }
  })

  // Default handler: treat any non-command text as a smart query
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return
    if (!isAuthorized(msg.chat.id)) return unauthorized(msg.chat.id)

    bot!.sendChatAction(msg.chat.id, 'typing')
    try {
      const answer = await runSmartQuery(msg.text)
      const trimmed = answer.length > 4000 ? answer.slice(0, 4000) + '...' : answer
      bot!.sendMessage(msg.chat.id, trimmed, { parse_mode: 'Markdown' }).catch(() => {
        bot!.sendMessage(msg.chat.id, trimmed)
      })
    } catch (err: any) {
      bot!.sendMessage(msg.chat.id, `Query failed: ${err.message}`)
    }
  })
}

// --- Public API ---

export function startTelegramBot(opts: TelegramSettings): { success: boolean; error?: string } {
  if (bot) stopTelegramBot()

  if (!opts.botToken || !opts.authorizedChatId) {
    return { success: false, error: 'Bot token and authorized chat ID are required' }
  }

  settings = opts
  try {
    bot = new TelegramBot(opts.botToken, { polling: true })
    registerCommands()

    bot.on('polling_error', (err) => {
      console.error('[telegram] Polling error:', err.message)
    })

    console.log('[telegram] Bot started, authorized chat:', opts.authorizedChatId)
    return { success: true }
  } catch (err: any) {
    bot = null
    return { success: false, error: err.message }
  }
}

export function stopTelegramBot() {
  if (bot) {
    bot.stopPolling()
    bot = null
    console.log('[telegram] Bot stopped')
  }
}

export function isTelegramBotRunning(): boolean {
  return bot !== null
}

export function getTelegramBotStatus(): { running: boolean; authorizedChatId: string } {
  return {
    running: bot !== null,
    authorizedChatId: settings.authorizedChatId,
  }
}
