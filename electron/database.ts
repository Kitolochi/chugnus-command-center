import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { app } from 'electron'

interface Task {
  id: number
  category_id: number
  title: string
  description?: string
  priority: number
  due_date?: string
  completed: number
  created_at: string
  updated_at?: string
  // Recurring fields
  is_recurring: boolean
  recurrence_type?: 'daily' | 'weekly' | 'monthly'
  recurrence_interval?: number // e.g., every 2 days, every 3 weeks
  last_completed?: string
}

interface Category {
  id: number
  name: string
  color: string
  icon: string
  sort_order: number
}

interface DailyNote {
  date: string
  content: string
  updated_at: string
}

interface Stats {
  currentStreak: number
  bestStreak: number
  lastStreakDate: string
  tasksCompletedThisWeek: number
  weekStartDate: string
}

interface TwitterSettings {
  bearerToken: string
  username: string
  userId: string
  listIds: { id: string; name: string }[]
  // OAuth 1.0a credentials for posting tweets
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
}

interface RSSFeed {
  url: string
  name: string
  category: string
}

interface ActivityEntry {
  date: string
  tasksCompleted: number
  focusMinutes: number
  categoriesWorked: string[]
}

interface PomodoroSession {
  taskId: number | null
  taskTitle: string
  startedAt: string
  durationMinutes: number
  type: 'work' | 'short_break' | 'long_break'
}

interface PomodoroState {
  isRunning: boolean
  currentSession: PomodoroSession | null
  sessionsCompleted: number
  totalSessionsToday: number
  todayDate: string
}

interface PomodoroHistoryRecord {
  id: string
  taskId: number | null
  taskTitle: string
  startedAt: string
  completedAt: string
  durationMinutes: number
  type: 'work' | 'break'
}

interface MorningBriefing {
  date: string
  content: string
  isAiEnhanced: boolean
  dismissed: boolean
  generatedAt: string
}

interface WeeklyReview {
  weekStartDate: string
  content: string
  generatedAt: string
  tasksCompletedCount: number
  categoriesWorked: string[]
  streakAtGeneration: number
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  model?: string
  tokenUsage?: { input: number; output: number }
}

interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  systemPrompt?: string
}

interface ChatSettings {
  model: string
  systemPromptMode: 'default' | 'context' | 'custom'
  maxTokens: number
  customSystemPrompt?: string
}

interface TweetAIMessage {
  id: string
  role: 'user' | 'assistant'
  type: 'brainstorm' | 'refine' | 'analyze' | 'freeform'
  content: string
  timestamp: string
}

interface TweetDraft {
  id: string
  text: string
  segments: string[]
  isThread: boolean
  status: 'draft' | 'refining' | 'ready' | 'posted'
  topic?: string
  aiHistory: TweetAIMessage[]
  createdAt: string
  updatedAt: string
  postedAt?: string
  tweetId?: string
  threadTweetIds: string[]
}

interface TweetPersona {
  id: string
  name: string
  description: string
  exampleTweets: string[]
  isBuiltIn: boolean
  createdAt: string
}

interface AITask {
  id: string
  title: string
  description: string
  column: 'backlog' | 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface RoadmapSubGoal {
  id: string
  title: string
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold'
  notes?: string
}

interface TopicReport {
  topic: string
  type: 'question' | 'guidance'
  report: string
  generatedAt: string
}

interface RoadmapGoal {
  id: string
  title: string
  description: string
  category: 'career' | 'health' | 'financial' | 'relationships' | 'learning' | 'projects' | 'personal' | 'creative'
  targetQuarter: 1 | 2 | 3 | 4
  targetYear: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold'
  research_questions: string[]
  guidance_needed: string[]
  notes: string
  sub_goals: RoadmapSubGoal[]
  tags: string[]
  topicReports: TopicReport[]
  personalContext?: string
  contextFiles?: string[]
  activityLog?: { id: string; type: string; description: string; timestamp: string }[]
  createdAt: string
  updatedAt: string
}

interface MasterPlanTask {
  id: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  goalId: string
  goalTitle: string
  phase: string
  status: 'pending' | 'launched' | 'running' | 'completed' | 'failed'
  launchedAt?: string
  completedAt?: string
  sessionId?: string
  taskType?: 'research' | 'code' | 'writing' | 'planning' | 'communication'
  createdAt: string
  planDate: string
}

interface Memory {
  id: string
  title: string
  content: string
  topics: string[]
  sourceType: 'chat' | 'cli_session' | 'journal' | 'task' | 'ai_task' | 'manual'
  sourceId: string | null
  sourcePreview: string
  importance: 1 | 2 | 3
  createdAt: string
  updatedAt: string
  isPinned: boolean
  isArchived: boolean
  relatedMemoryIds: string[]
}

interface MemoryTopic {
  name: string
  color: string
  memoryCount: number
}

interface MemorySettings {
  autoGenerate: boolean
  maxMemoriesInContext: number
  tokenBudget: number
}

export interface LLMSettings {
  provider: 'claude' | 'gemini' | 'groq' | 'openrouter' | 'chatgpt' | 'claudeProxy'
  geminiApiKey: string
  groqApiKey: string
  openrouterApiKey: string
  primaryModel: string
  fastModel: string
}

export interface BankConnection {
  id: string
  provider: 'simplefin' | 'teller'
  accessToken: string
  status: 'active' | 'error' | 'disconnected'
  errorMessage?: string
  lastSynced?: string
  createdAt: string
  updatedAt: string
}

export interface BankAccount {
  id: string
  connectionId: string
  externalId: string
  name: string
  institution: string
  accountType: 'checking' | 'savings' | 'credit_card' | 'loan' | 'mortgage' | 'investment' | 'other'
  balance: number
  availableBalance?: number
  currency: string
  lastSynced?: string
}

export interface BankTransaction {
  id: string
  accountId: string
  externalId: string
  dedupHash: string
  amount: number
  date: string
  description: string
  category?: string
  merchant?: string
  pending: boolean
  importedAt: string
}

type SocialProvider = 'telegram' | 'discord' | 'twitter' | 'sms' | 'chatgpt'
type SocialConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'error'

interface SocialConnection {
  id: string
  provider: SocialProvider
  accountId: string
  accountName: string
  status: SocialConnectionStatus
  lastSyncAt: string | null
  credentials: string
  createdAt: string
  updatedAt: string
}

interface ContactMapping {
  id: string
  contactId: string
  provider: SocialProvider
  externalId: string
  externalName: string
  createdAt: string
}

type InteractionType = 'call' | 'email' | 'meeting' | 'message' | 'note'

interface NetworkContact {
  id: string
  name: string
  company: string
  role: string
  email: string
  phone: string
  socialLinks: { twitter?: string; linkedin?: string; github?: string }
  notes: string
  tags: string[]
  avatarColor: string
  createdAt: string
  updatedAt: string
}

interface ContactInteraction {
  id: string
  contactIds: string[]
  type: InteractionType
  subject: string
  notes: string
  date: string
  createdAt: string
}

interface Pipeline {
  id: string
  name: string
  stages: string[]
  createdAt: string
  updatedAt: string
}

interface PipelineCard {
  id: string
  contactId: string
  pipelineId: string
  stage: string
  title: string
  description: string
  value: string
  createdAt: string
  updatedAt: string
}

interface ContentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ContentDraft {
  id: string
  contentType: 'tweet' | 'thread' | 'blog_post' | 'article' | 'discord_post' | 'newsletter'
  topic: string
  research: string
  outline: string
  content: string
  messages: ContentMessage[]
  status: 'researching' | 'outlined' | 'drafting' | 'refining' | 'ready'
  scores?: { index: number; hook: number; clarity: number; viral: number; feedback?: string; strengths?: string[]; weaknesses?: string[] }[]
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  description: string
  date: string          // YYYY-MM-DD (start date for recurring)
  startTime: string     // HH:mm (empty = all-day)
  endTime: string       // HH:mm
  color: string         // accent color key (emerald, blue, amber, purple)
  source: 'manual' | 'gcal'
  gcalEventId?: string
  recurrence?: 'weekly'  // repeats every week from date onward
  createdAt: string
}

export interface Routine {
  id: string
  name: string
  type: 'morning-briefing' | 'pr-monitor' | 'email-digest' | 'weekly-review' | 'custom'
  schedule: {
    trigger: 'app-launch' | 'interval' | 'daily' | 'weekly'
    time?: string            // HH:mm for daily/weekly
    intervalMinutes?: number // for interval trigger
    dayOfWeek?: number       // 0-6 for weekly trigger
  }
  config: Record<string, any>
  enabled: boolean
  lastRun?: string           // ISO timestamp
  createdAt: string
}

export interface RoutineResult {
  id: string
  routineId: string
  timestamp: string          // ISO
  summary: string
  detail: string             // markdown content
  status: 'success' | 'error'
  date: string               // YYYY-MM-DD for calendar day lookup
}

export interface Agent {
  id: string
  name: string
  role: 'engineer' | 'researcher' | 'writer' | 'planner' | 'designer' | 'custom'
  description: string
  adapter: 'claude_local'
  adapterConfig: {
    taskType?: 'research' | 'code' | 'writing' | 'planning' | 'communication'
    allowedTools?: string
    preamble?: string
    cwd?: string
  }
  reportsTo?: string
  budgetMonthlyCents: number
  spentMonthlyCents: number
  budgetResetDate: string
  status: 'active' | 'paused' | 'idle' | 'running' | 'error'
  lastError?: string
  consecutiveFailures?: number
  cooldownUntil?: string
  heartbeat?: {
    enabled: boolean
    schedule: { trigger: 'interval' | 'daily' | 'weekly'; time?: string; intervalMinutes?: number; dayOfWeek?: number }
    lastRun?: string
  }
  sessionState?: {
    sessionId?: string
    cumulativeInputTokens: number
    cumulativeOutputTokens: number
    cumulativeCostCents: number
  }
  createdAt: string
  updatedAt: string
}

export interface AgentIssue {
  id: string
  title: string
  description: string
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled'
  priority: 'critical' | 'high' | 'medium' | 'low'
  assignedAgentId?: string
  goalId?: string
  tags: string[]
  checkedOutAt?: string
  checkedOutRunId?: string
  result?: string
  deliverables?: string[]
  blockedBy?: string[]
  estimatedComplexity?: 'S' | 'M' | 'L'
  escalationLevel?: number
  escalatedAt?: string
  stage?: 'research' | 'development' | 'review' | 'committed' | 'pushed' | 'live'
  targetStage?: 'research' | 'development' | 'review' | 'committed' | 'pushed' | 'live'
  maxIterations?: number
  iteration?: number
  createdAt: string
  updatedAt: string
}

export interface HeartbeatRun {
  id: string
  agentId: string
  issueId?: string
  source: 'timer' | 'manual' | 'assignment'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out'
  prompt: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  sessionId?: string
  inputTokens?: number
  outputTokens?: number
  costCents?: number
  summary?: string
  error?: string
  tags?: string[]
  retryCount?: number
  nextRetryAt?: string
  structuredResult?: { filesChanged?: string[]; toolCalls?: { tool: string; count: number }[]; gitCommits?: string[] }
  parentRunId?: string
  iteration?: number
  checkpoint?: { filesChanged?: string[]; partialSummary?: string; toolCallCount?: number }
  createdAt: string
}

export interface AgentEvent {
  id: string
  timestamp: string
  agentId: string
  runId?: string
  issueId?: string
  type: 'launch' | 'complete' | 'fail' | 'retry' | 'requeue' | 'budget_alert' | 'escalation' | 'cooldown' | 'pause' | 'resume' | 'auto_relaunch'
  detail: string
}

export interface CostEvent {
  id: string
  agentId: string
  issueId?: string
  heartbeatRunId?: string
  source: 'heartbeat' | 'chat' | 'research' | 'manual'
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costCents: number
  timestamp: string
}

export interface CCHistoryEntry {
  id: string
  sessionId?: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  summary: string
  status: 'running' | 'completed' | 'killed' | 'parked' | 'crashed'
  filesChanged: string[]
  costUsd: number
  turnCount: number
  startedAt: number
  completedAt: number
}

export interface KnownProject {
  path: string
  name: string
  lastUsed: number
}

export interface CollabHistoryEntry {
  id: string
  task: string
  status: 'running' | 'awaiting_input' | 'completed' | 'killed' | 'errored'
  turns: {
    id: string
    agent: 'claude' | 'gpt'
    content: string
    tokensIn: number
    tokensOut: number
    costUsd: number
    durationMs: number
    timestamp: number
  }[]
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  totalCostUsd: number
  roundCount: number
  summary?: string
  errorMessage?: string
  parentSessionId?: string
  startedAt: number
  updatedAt: number
  completedAt?: number
}

interface Database {
  categories: Category[]
  tasks: Task[]
  dailyNotes: DailyNote[]
  nextTaskId: number
  stats: Stats
  twitter: TwitterSettings
  rssFeeds: RSSFeed[]
  claudeApiKey: string
  tavilyApiKey: string
  activityLog: ActivityEntry[]
  pomodoroState: PomodoroState
  pomodoroHistory: PomodoroHistoryRecord[]
  morningBriefings: MorningBriefing[]
  weeklyReviews: WeeklyReview[]
  chatConversations: ChatConversation[]
  chatSettings: ChatSettings
  tweetDrafts: TweetDraft[]
  tweetPersonas: TweetPersona[]
  aiTasks: AITask[]
  roadmapGoals: RoadmapGoal[]
  masterPlan: { content: string; generatedAt: string; goalIds: string[]; metadata: { totalGoals: number; goalsWithResearch: number } } | null
  masterPlanTasks: MasterPlanTask[]
  memories: Memory[]
  memoryTopics: MemoryTopic[]
  memorySettings: MemorySettings
  welcomeDismissed: boolean
  llmSettings: LLMSettings
  bankConnections: BankConnection[]
  bankAccounts: BankAccount[]
  bankTransactions: BankTransaction[]
  networkContacts: NetworkContact[]
  contactInteractions: ContactInteraction[]
  pipelines: Pipeline[]
  pipelineCards: PipelineCard[]
  socialConnections: SocialConnection[]
  contactMappings: ContactMapping[]
  contentDrafts: ContentDraft[]
  tweetPatterns: { id: string; type: 'positive' | 'negative'; pattern: string; avgScore: number; occurrences: number; exampleTweet: string; extractedAt: string }[]
  scoreSnapshots: { date: string; draftsScored: number; tweetsScored: number; avgHook: number; avgClarity: number; avgViral: number; avgOverall: number; above8Count: number; below5Count: number }[]
  categoryOverrides: Record<string, string>  // transactionId -> categoryKey
  calendarEvents: CalendarEvent[]
  lastDailyNotifDate: string
  routines: Routine[]
  routineResults: RoutineResult[]
  agents: Agent[]
  agentIssues: AgentIssue[]
  heartbeatRuns: HeartbeatRun[]
  costEvents: CostEvent[]
  agentEvents: AgentEvent[]
  // Command Center
  commandCenterHistory: CCHistoryEntry[]
  knownProjects: KnownProject[]
  // Dual-Agent Collab
  collabHistory: CollabHistoryEntry[]
}

let db: Database
let dbPath: string

function getWeekStart(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Monday
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

function checkWeeklyReset() {
  const currentWeekStart = getWeekStart()
  if (db.stats.weekStartDate !== currentWeekStart) {
    db.stats.tasksCompletedThisWeek = 0
    db.stats.weekStartDate = currentWeekStart
    saveDatabase()
  }
}

const defaultCategories: Category[] = [
  { id: 1, name: 'Work', color: '#3b82f6', icon: '💼', sort_order: 1 },
  { id: 2, name: 'Relationships', color: '#ec4899', icon: '💕', sort_order: 2 },
  { id: 3, name: 'House', color: '#22c55e', icon: '🏠', sort_order: 3 },
  { id: 4, name: 'Goals', color: '#8b5cf6', icon: '🎯', sort_order: 4 },
  { id: 5, name: 'Health', color: '#f97316', icon: '💪', sort_order: 5 },
  { id: 6, name: 'Financials', color: '#eab308', icon: '💰', sort_order: 6 },
  { id: 7, name: 'Daily', color: '#14b8a6', icon: '📋', sort_order: 7 },
]

export function initDatabase(): Database {
  dbPath = path.join(app.getPath('userData'), 'chugnus-command-center.json')

  if (fs.existsSync(dbPath)) {
    let data = fs.readFileSync(dbPath, 'utf-8')

    // Crash recovery: if file is empty/corrupt, restore from latest backup
    if (!data || data.trim().length < 10) {
      console.warn('[db] Database file is empty or corrupt, attempting backup recovery...')
      const backupDir = path.join(path.dirname(dbPath), 'backups')
      if (fs.existsSync(backupDir)) {
        const backups = fs.readdirSync(backupDir)
          .filter(f => f.startsWith('chugnus-cc-') && f.endsWith('.json'))
          .sort()
          .reverse()
        for (const backup of backups) {
          try {
            const backupData = fs.readFileSync(path.join(backupDir, backup), 'utf-8')
            if (backupData.length > 100) {
              JSON.parse(backupData) // validate it's valid JSON
              data = backupData
              fs.writeFileSync(dbPath, data, 'utf-8')
              console.log(`[db] Restored from backup: ${backup}`)
              break
            }
          } catch {}
        }
      }
      if (!data || data.trim().length < 10) {
        console.error('[db] No valid backup found, creating fresh database')
        fs.unlinkSync(dbPath) // remove corrupt file, fall through to fresh creation
      }
    }

    if (data && data.trim().length >= 10) {
    db = JSON.parse(data)
    if (!db.dailyNotes) {
      db.dailyNotes = []
    }
    // Migrate old tasks to have recurring fields
    db.tasks = db.tasks.map(t => ({
      ...t,
      is_recurring: t.is_recurring || false
    }))
    if (!db.categories.find(c => c.id === 7)) {
      db.categories.push({ id: 7, name: 'Daily', color: '#14b8a6', icon: '📋', sort_order: 7 })
    }
    // Clean orphaned bank transactions (accountId not in bankAccounts)
    if (db.bankAccounts && db.bankTransactions) {
      const validIds = new Set(db.bankAccounts.map((a: any) => a.id))
      const before = db.bankTransactions.length
      db.bankTransactions = db.bankTransactions.filter((t: any) => validIds.has(t.accountId))
      const removed = before - db.bankTransactions.length
      if (removed > 0) console.log(`[db] Cleaned ${removed} orphaned bank transactions`)

      // Deduplicate by externalId (keep the first occurrence, remove later copies)
      const seenExtIds = new Set<string>()
      const beforeDedup = db.bankTransactions.length
      db.bankTransactions = db.bankTransactions.filter((t: any) => {
        if (!t.externalId) return true // keep transactions without externalId
        if (seenExtIds.has(t.externalId)) return false
        seenExtIds.add(t.externalId)
        return true
      })
      const dupsRemoved = beforeDedup - db.bankTransactions.length
      if (dupsRemoved > 0) console.log(`[db] Removed ${dupsRemoved} duplicate bank transactions`)
    }
    saveDatabase()
    } // end: if data valid
  } else {
    db = {
      categories: defaultCategories,
      tasks: [],
      dailyNotes: [],
      nextTaskId: 1,
      stats: {
        currentStreak: 0,
        bestStreak: 0,
        lastStreakDate: '',
        tasksCompletedThisWeek: 0,
        weekStartDate: getWeekStart()
      },
      twitter: { bearerToken: '', username: '', userId: '', listIds: [], apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' },
      rssFeeds: [],
      claudeApiKey: '',
      tavilyApiKey: '',
      activityLog: [],
      pomodoroState: {
        isRunning: false,
        currentSession: null,
        sessionsCompleted: 0,
        totalSessionsToday: 0,
        todayDate: new Date().toISOString().split('T')[0]
      },
      morningBriefings: [],
      weeklyReviews: [],
      chatConversations: [],
      chatSettings: {
        model: 'claude-sonnet-4-5-20250929',
        systemPromptMode: 'default',
        maxTokens: 4096
      },
      tweetDrafts: [],
      tweetPersonas: [],
      aiTasks: [],
      roadmapGoals: [],
      llmSettings: {
        provider: 'claude',
        geminiApiKey: '',
        groqApiKey: '',
        openrouterApiKey: '',
        primaryModel: 'claude-sonnet-4-5-20250929',
        fastModel: 'claude-haiku-4-5-20251001'
      }
    }
    saveDatabase()
  }

  // Initialize twitter settings if missing
  if (!db.twitter) {
    db.twitter = { bearerToken: '', username: '', userId: '', listIds: [], apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' }
    saveDatabase()
  }

  // Migrate: add OAuth fields if missing
  if (db.twitter.apiKey === undefined) {
    db.twitter.apiKey = ''
    db.twitter.apiSecret = ''
    db.twitter.accessToken = ''
    db.twitter.accessTokenSecret = ''
    saveDatabase()
  }

  // Initialize rssFeeds if missing
  if (!db.rssFeeds) {
    db.rssFeeds = []
    saveDatabase()
  }

  // Migrate feeds without category
  if (db.rssFeeds.length > 0 && !(db.rssFeeds[0] as any).category) {
    db.rssFeeds = db.rssFeeds.map(f => ({ ...f, category: (f as any).category || 'ai' }))
    saveDatabase()
  }

  // Initialize claudeApiKey if missing
  if (db.claudeApiKey === undefined) {
    db.claudeApiKey = ''
    saveDatabase()
  }

  // Initialize tavilyApiKey if missing
  if ((db as any).tavilyApiKey === undefined) {
    db.tavilyApiKey = ''
    saveDatabase()
  }

  // Initialize activityLog if missing
  if (!db.activityLog) {
    db.activityLog = []
    saveDatabase()
  }

  // Initialize pomodoroState if missing
  if (!db.pomodoroState) {
    db.pomodoroState = {
      isRunning: false,
      currentSession: null,
      sessionsCompleted: 0,
      totalSessionsToday: 0,
      todayDate: new Date().toISOString().split('T')[0]
    }
    saveDatabase()
  }

  // Initialize pomodoroHistory if missing
  if (!db.pomodoroHistory) {
    db.pomodoroHistory = []
    saveDatabase()
  }

  // Initialize morningBriefings if missing
  if (!db.morningBriefings) {
    db.morningBriefings = []
    saveDatabase()
  }

  // Initialize weeklyReviews if missing
  if (!db.weeklyReviews) {
    db.weeklyReviews = []
    saveDatabase()
  }

  // Initialize chatConversations if missing
  if (!db.chatConversations) {
    db.chatConversations = []
    saveDatabase()
  }

  // Initialize chatSettings if missing
  if (!db.chatSettings) {
    db.chatSettings = {
      model: 'claude-sonnet-4-5-20250929',
      systemPromptMode: 'default',
      maxTokens: 4096
    }
    saveDatabase()
  }

  // Initialize tweetDrafts if missing
  if (!db.tweetDrafts) {
    db.tweetDrafts = []
    saveDatabase()
  }

  // Migrate tweetDrafts: add thread fields if missing
  let draftsNeedMigration = false
  db.tweetDrafts = db.tweetDrafts.map(d => {
    if (d.segments === undefined) {
      draftsNeedMigration = true
      return { ...d, segments: d.text ? [d.text] : [''], isThread: false, threadTweetIds: [] }
    }
    return d
  })
  if (draftsNeedMigration) saveDatabase()

  // Initialize tweetPersonas if missing
  if (!db.tweetPersonas) {
    db.tweetPersonas = []
    saveDatabase()
  }

  // Initialize aiTasks if missing
  if (!db.aiTasks) {
    db.aiTasks = []
    saveDatabase()
  }

  // Initialize roadmapGoals if missing
  if (!db.roadmapGoals) {
    db.roadmapGoals = []
    saveDatabase()
  }

  // Initialize masterPlan if missing
  if ((db as any).masterPlan === undefined) {
    db.masterPlan = null
    saveDatabase()
  }

  // Migrate roadmapGoals: add topicReports if missing
  let goalsNeedMigration = false
  db.roadmapGoals = db.roadmapGoals.map(g => {
    if ((g as any).topicReports === undefined) {
      goalsNeedMigration = true
      return { ...g, topicReports: [] }
    }
    return g
  })
  if (goalsNeedMigration) saveDatabase()

  // Migrate roadmapGoals: add contextFiles if missing
  let goalsNeedContextFilesMigration = false
  db.roadmapGoals = db.roadmapGoals.map(g => {
    if ((g as any).contextFiles === undefined) {
      goalsNeedContextFilesMigration = true
      return { ...g, contextFiles: [] }
    }
    return g
  })
  if (goalsNeedContextFilesMigration) saveDatabase()

  // Initialize masterPlanTasks if missing
  if (!(db as any).masterPlanTasks) {
    db.masterPlanTasks = []
    saveDatabase()
  }

  // Initialize memories if missing
  if (!db.memories) {
    db.memories = []
    saveDatabase()
  }

  // Initialize memoryTopics if missing
  if (!db.memoryTopics) {
    db.memoryTopics = []
    saveDatabase()
  }

  // Initialize memorySettings if missing
  if (!db.memorySettings) {
    db.memorySettings = { autoGenerate: false, maxMemoriesInContext: 5, tokenBudget: 800 }
    saveDatabase()
  }

  // Initialize stats if missing
  if (!db.stats) {
    db.stats = {
      currentStreak: 0,
      bestStreak: 0,
      lastStreakDate: '',
      tasksCompletedThisWeek: 0,
      weekStartDate: getWeekStart()
    }
    saveDatabase()
  }

  // Initialize welcomeDismissed if missing
  if ((db as any).welcomeDismissed === undefined) {
    db.welcomeDismissed = false
    saveDatabase()
  }

  // Initialize llmSettings if missing
  if (!(db as any).llmSettings) {
    db.llmSettings = {
      provider: 'claude',
      geminiApiKey: '',
      groqApiKey: '',
      openrouterApiKey: '',
      primaryModel: 'claude-sonnet-4-5-20250929',
      fastModel: 'claude-haiku-4-5-20251001'
    }
    saveDatabase()
  }

  // Initialize bankConnections if missing
  if (!(db as any).bankConnections) {
    db.bankConnections = []
    saveDatabase()
  }

  // Initialize bankAccounts if missing
  if (!(db as any).bankAccounts) {
    db.bankAccounts = []
    saveDatabase()
  }

  // Initialize bankTransactions if missing
  if (!(db as any).bankTransactions) {
    db.bankTransactions = []
    saveDatabase()
  }

  // Initialize network CRM collections if missing
  if (!(db as any).networkContacts) {
    db.networkContacts = []
    saveDatabase()
  }
  if (!(db as any).contactInteractions) {
    db.contactInteractions = []
    saveDatabase()
  }
  if (!(db as any).pipelines) {
    db.pipelines = []
    saveDatabase()
  }
  if (!(db as any).pipelineCards) {
    db.pipelineCards = []
    saveDatabase()
  }

  // Initialize socialConnections if missing
  if (!(db as any).socialConnections) {
    db.socialConnections = []
    saveDatabase()
  }

  // Initialize contactMappings if missing
  if (!(db as any).contactMappings) {
    db.contactMappings = []
    saveDatabase()
  }

  // Initialize contentDrafts if missing
  if (!(db as any).contentDrafts) {
    db.contentDrafts = []
    saveDatabase()
  }

  // Initialize tweetPatterns if missing
  if (!Array.isArray((db as any).tweetPatterns)) {
    db.tweetPatterns = []
    saveDatabase()
  }

  // Initialize scoreSnapshots if missing
  if (!Array.isArray((db as any).scoreSnapshots)) {
    db.scoreSnapshots = []
    saveDatabase()
  }

  // Initialize categoryOverrides if missing
  if (!(db as any).categoryOverrides) {
    db.categoryOverrides = {}
    saveDatabase()
  }

  // Initialize calendarEvents if missing
  if (!(db as any).calendarEvents) {
    db.calendarEvents = []
    saveDatabase()
  }

  // Initialize lastDailyNotifDate if missing
  if (!(db as any).lastDailyNotifDate) {
    db.lastDailyNotifDate = ''
    saveDatabase()
  }

  // Initialize routines if missing
  if (!Array.isArray((db as any).routines)) {
    db.routines = []
    saveDatabase()
  }

  // Initialize routineResults if missing
  if (!Array.isArray((db as any).routineResults)) {
    db.routineResults = []
    saveDatabase()
  }

  // Initialize agent orchestration arrays if missing
  if (!Array.isArray((db as any).agents)) {
    db.agents = []
    saveDatabase()
  }
  if (!Array.isArray((db as any).agentIssues)) {
    db.agentIssues = []
    saveDatabase()
  }
  if (!Array.isArray((db as any).heartbeatRuns)) {
    db.heartbeatRuns = []
    saveDatabase()
  }
  if (!Array.isArray((db as any).costEvents)) {
    db.costEvents = []
    saveDatabase()
  }
  if (!Array.isArray((db as any).agentEvents)) {
    db.agentEvents = []
    saveDatabase()
  }

  // Initialize Command Center arrays if missing
  if (!Array.isArray((db as any).commandCenterHistory)) {
    db.commandCenterHistory = []
    saveDatabase()
  }
  if (!Array.isArray((db as any).knownProjects)) {
    db.knownProjects = []
    saveDatabase()
  }

  // Initialize collabHistory if missing
  if (!Array.isArray((db as any).collabHistory)) {
    db.collabHistory = []
    saveDatabase()
  }

  // Reset weekly stats if new week
  checkWeeklyReset()

  // Check and reset recurring tasks on startup
  checkRecurringTasks()

  return db
}

const MAX_BACKUPS = 5

function saveDatabase() {
  const data = JSON.stringify(db, null, 2)
  // Safety: never write empty or tiny data (corrupt state)
  if (data.length < 50) return

  // Rotate backups before writing
  try {
    if (fs.existsSync(dbPath)) {
      const backupDir = path.join(path.dirname(dbPath), 'backups')
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

      // Rotate: remove oldest if at limit
      const existing = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('chugnus-cc-') && f.endsWith('.json'))
        .sort()
      while (existing.length >= MAX_BACKUPS) {
        fs.unlinkSync(path.join(backupDir, existing.shift()!))
      }

      // Copy current file as timestamped backup
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      fs.copyFileSync(dbPath, path.join(backupDir, `chugnus-cc-${ts}.json`))
    }
  } catch (err) {
    console.error('[db] Backup failed:', err)
  }

  // Write atomically: write to temp file, then rename
  const tmpPath = dbPath + '.tmp'
  fs.writeFileSync(tmpPath, data, 'utf-8')
  fs.renameSync(tmpPath, dbPath)
}

/** Get the current date string in EST/EDT (America/New_York) */
function getESTDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // 'en-CA' gives YYYY-MM-DD
}

/** Get EST date parts for month-based comparisons */
function getESTParts(date: Date = new Date()): { year: number; month: number; day: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const year = parseInt(parts.find(p => p.type === 'year')!.value)
  const month = parseInt(parts.find(p => p.type === 'month')!.value)
  const day = parts.map(p => p.value).join('')
  return { year, month, day }
}

/** Count calendar days between two dates in EST */
function estDaysBetween(a: Date, b: Date): number {
  const dateA = getESTDate(a)
  const dateB = getESTDate(b)
  const msA = new Date(dateA + 'T00:00:00').getTime()
  const msB = new Date(dateB + 'T00:00:00').getTime()
  return Math.floor((msB - msA) / (1000 * 60 * 60 * 24))
}

function checkRecurringTasks() {
  let changed = false
  const now = new Date()
  const todayEST = getESTDate(now)

  db.tasks.forEach(task => {
    // Daily category tasks always reset at the start of each EST day
    if (task.category_id === DAILY_CATEGORY_ID && task.completed) {
      const completedAt = task.last_completed || task.updated_at || task.created_at
      const completedDateEST = getESTDate(new Date(completedAt))
      if (completedDateEST !== todayEST) {
        task.completed = 0
        task.updated_at = now.toISOString()
        changed = true
      }
      return
    }

    // Other recurring tasks use interval-based logic
    if (task.is_recurring && task.completed && task.last_completed) {
      const lastCompleted = new Date(task.last_completed)
      let shouldReset = false

      if (task.recurrence_type === 'daily') {
        const interval = task.recurrence_interval || 1
        shouldReset = estDaysBetween(lastCompleted, now) >= interval
      } else if (task.recurrence_type === 'weekly') {
        const interval = task.recurrence_interval || 1
        shouldReset = estDaysBetween(lastCompleted, now) >= (interval * 7)
      } else if (task.recurrence_type === 'monthly') {
        const interval = task.recurrence_interval || 1
        const lastParts = getESTParts(lastCompleted)
        const nowParts = getESTParts(now)
        const monthsDiff = (nowParts.year - lastParts.year) * 12 + (nowParts.month - lastParts.month)
        shouldReset = monthsDiff >= interval
      }

      if (shouldReset) {
        task.completed = 0
        task.updated_at = now.toISOString()
        changed = true
      }
    }
  })

  if (changed) saveDatabase()
  return changed
}

export { checkRecurringTasks }

export function systemWipe(): void {
  // Delete backups directory
  const backupDir = path.join(path.dirname(dbPath), 'backups')
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir)
    for (const f of files) {
      fs.unlinkSync(path.join(backupDir, f))
    }
    fs.rmdirSync(backupDir)
  }

  // Delete main database file
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
  }

  // Reinitialize fresh database
  initDatabase()
}

export function getCategories(): Category[] {
  return db.categories.sort((a, b) => a.sort_order - b.sort_order)
}

export function addCategory(name: string, color: string, icon: string): Category {
  const maxId = Math.max(...db.categories.map(c => c.id), 0)
  const maxSort = Math.max(...db.categories.map(c => c.sort_order), 0)
  const cat: Category = { id: maxId + 1, name, color, icon, sort_order: maxSort + 1 }
  db.categories.push(cat)
  saveDatabase()
  return cat
}

const DAILY_CATEGORY_ID = 7

export function deleteCategory(id: number): void {
  // Never delete the locked Daily category
  if (id === DAILY_CATEGORY_ID) return
  // Don't delete if tasks exist in this category
  const hasTasks = db.tasks.some(t => t.category_id === id)
  if (hasTasks) return
  db.categories = db.categories.filter(c => c.id !== id)
  saveDatabase()
}

export function getTasks(categoryId?: number): Task[] {
  let tasks = db.tasks
  if (categoryId) {
    tasks = tasks.filter(t => t.category_id === categoryId)
  }
  return tasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed - b.completed
    if (a.priority !== b.priority) return a.priority - b.priority
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function addTask(task: {
  category_id: number
  title: string
  description?: string
  priority?: number
  due_date?: string
  is_recurring?: boolean
  recurrence_type?: 'daily' | 'weekly' | 'monthly'
  recurrence_interval?: number
}): Task {
  const newTask: Task = {
    id: db.nextTaskId++,
    category_id: task.category_id,
    title: task.title,
    description: task.description,
    priority: task.priority || 2,
    due_date: task.due_date,
    completed: 0,
    created_at: new Date().toISOString(),
    is_recurring: task.is_recurring || false,
    recurrence_type: task.recurrence_type,
    recurrence_interval: task.recurrence_interval || 1
  }

  db.tasks.push(newTask)
  saveDatabase()
  return newTask
}

export function updateTask(id: number, updates: {
  title?: string
  description?: string
  priority?: number
  due_date?: string
  completed?: number
  category_id?: number
  is_recurring?: boolean
  recurrence_type?: 'daily' | 'weekly' | 'monthly'
  recurrence_interval?: number
}): Task | null {
  const taskIndex = db.tasks.findIndex(t => t.id === id)
  if (taskIndex === -1) return null

  const task = db.tasks[taskIndex]

  if (updates.title !== undefined) task.title = updates.title
  if (updates.description !== undefined) task.description = updates.description
  if (updates.priority !== undefined) task.priority = updates.priority
  if (updates.due_date !== undefined) task.due_date = updates.due_date
  if (updates.completed !== undefined) task.completed = updates.completed
  if (updates.category_id !== undefined) task.category_id = updates.category_id
  if (updates.is_recurring !== undefined) task.is_recurring = updates.is_recurring
  if (updates.recurrence_type !== undefined) task.recurrence_type = updates.recurrence_type
  if (updates.recurrence_interval !== undefined) task.recurrence_interval = updates.recurrence_interval

  task.updated_at = new Date().toISOString()

  saveDatabase()
  return task
}

export function deleteTask(id: number): { success: boolean } {
  const taskIndex = db.tasks.findIndex(t => t.id === id)
  if (taskIndex === -1) return { success: false }

  db.tasks.splice(taskIndex, 1)
  saveDatabase()
  return { success: true }
}

export function toggleTaskComplete(id: number): Task | null {
  const task = db.tasks.find(t => t.id === id)
  if (!task) return null

  const wasCompleted = task.completed === 1

  if (task.completed === 0) {
    // Marking as complete
    task.completed = 1
    if (task.is_recurring || task.category_id === DAILY_CATEGORY_ID) {
      task.last_completed = new Date().toISOString()
    }
    // Update weekly stats
    db.stats.tasksCompletedThisWeek++

    // Log activity
    const category = db.categories.find(c => c.id === task.category_id)
    logActivity('task_complete', { categoryName: category?.name || 'Unknown' })

    // Check streak - if all high priority tasks are done today
    updateStreak()
  } else {
    // Marking as incomplete
    task.completed = 0
    if (wasCompleted) {
      db.stats.tasksCompletedThisWeek = Math.max(0, db.stats.tasksCompletedThisWeek - 1)
    }
    logActivity('task_uncomplete', {})
  }

  task.updated_at = new Date().toISOString()

  saveDatabase()
  return task
}

function updateStreak() {
  const today = new Date().toISOString().split('T')[0]
  const highPriorityTasks = db.tasks.filter(t => t.priority === 1)
  const allHighDone = highPriorityTasks.length > 0 && highPriorityTasks.every(t => t.completed)

  if (allHighDone) {
    if (db.stats.lastStreakDate !== today) {
      // Check if yesterday was the last streak day (continuing streak)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      if (db.stats.lastStreakDate === yesterdayStr || db.stats.lastStreakDate === '') {
        db.stats.currentStreak++
      } else {
        // Streak broken, start new
        db.stats.currentStreak = 1
      }

      db.stats.lastStreakDate = today
      if (db.stats.currentStreak > db.stats.bestStreak) {
        db.stats.bestStreak = db.stats.currentStreak
      }
    }
  }
}

export function getStats(): Stats {
  return db.stats
}

// Daily Notes functions
export function getDailyNote(date: string): DailyNote | null {
  return db.dailyNotes.find(n => n.date === date) || null
}

export function saveDailyNote(date: string, content: string): DailyNote {
  const existingIndex = db.dailyNotes.findIndex(n => n.date === date)
  const note: DailyNote = {
    date,
    content,
    updated_at: new Date().toISOString()
  }

  if (existingIndex !== -1) {
    db.dailyNotes[existingIndex] = note
  } else {
    db.dailyNotes.push(note)
  }

  saveDatabase()
  return note
}

export function getRecentNotes(limit: number = 7): DailyNote[] {
  return db.dailyNotes
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
}

// Twitter settings
export function getTwitterSettings(): TwitterSettings {
  return db.twitter
}

export function saveTwitterSettings(settings: Partial<TwitterSettings>): TwitterSettings {
  if (settings.bearerToken !== undefined) db.twitter.bearerToken = settings.bearerToken
  if (settings.username !== undefined) db.twitter.username = settings.username
  if (settings.userId !== undefined) db.twitter.userId = settings.userId
  if (settings.listIds !== undefined) db.twitter.listIds = settings.listIds
  if (settings.apiKey !== undefined) db.twitter.apiKey = settings.apiKey
  if (settings.apiSecret !== undefined) db.twitter.apiSecret = settings.apiSecret
  if (settings.accessToken !== undefined) db.twitter.accessToken = settings.accessToken
  if (settings.accessTokenSecret !== undefined) db.twitter.accessTokenSecret = settings.accessTokenSecret
  saveDatabase()
  return db.twitter
}

// RSS Feeds
export function getRSSFeeds(): RSSFeed[] {
  return db.rssFeeds
}

export function addRSSFeed(feed: RSSFeed): RSSFeed[] {
  if (!db.rssFeeds.find(f => f.url === feed.url)) {
    db.rssFeeds.push(feed)
    saveDatabase()
  }
  return db.rssFeeds
}

export function removeRSSFeed(url: string): RSSFeed[] {
  db.rssFeeds = db.rssFeeds.filter(f => f.url !== url)
  saveDatabase()
  return db.rssFeeds
}

export function getClaudeApiKey(): string {
  return db.claudeApiKey || ''
}

export function saveClaudeApiKey(key: string): void {
  db.claudeApiKey = key
  saveDatabase()
}

export function getTavilyApiKey(): string {
  return db.tavilyApiKey || ''
}

export function saveTavilyApiKey(key: string): void {
  db.tavilyApiKey = key
  saveDatabase()
}

// Activity Log functions
function logActivity(type: string, data: { categoryName?: string; minutes?: number }) {
  const today = new Date().toISOString().split('T')[0]
  let entry = db.activityLog.find(e => e.date === today)
  if (!entry) {
    entry = { date: today, tasksCompleted: 0, focusMinutes: 0, categoriesWorked: [] }
    db.activityLog.push(entry)
  }

  if (type === 'task_complete') {
    entry.tasksCompleted++
    if (data.categoryName && !entry.categoriesWorked.includes(data.categoryName)) {
      entry.categoriesWorked.push(data.categoryName)
    }
  } else if (type === 'task_uncomplete') {
    entry.tasksCompleted = Math.max(0, entry.tasksCompleted - 1)
  } else if (type === 'focus_minutes') {
    entry.focusMinutes += data.minutes || 0
  }

  saveDatabase()
}

export function getActivityLog(days: number = 90): ActivityEntry[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return db.activityLog.filter(e => e.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date))
}

// Pomodoro functions
export function getPomodoroState(): PomodoroState {
  const today = new Date().toISOString().split('T')[0]
  if (db.pomodoroState.todayDate !== today) {
    db.pomodoroState.totalSessionsToday = 0
    db.pomodoroState.sessionsCompleted = 0
    db.pomodoroState.todayDate = today
    saveDatabase()
  }
  return db.pomodoroState
}

export function startPomodoro(taskId: number | null, taskTitle: string, durationMinutes: number = 25): PomodoroState {
  db.pomodoroState.isRunning = true
  db.pomodoroState.currentSession = {
    taskId,
    taskTitle,
    startedAt: new Date().toISOString(),
    durationMinutes,
    type: 'work'
  }
  saveDatabase()
  return db.pomodoroState
}

export function completePomodoro(): PomodoroState {
  if (db.pomodoroState.currentSession?.type === 'work') {
    db.pomodoroState.sessionsCompleted++
    db.pomodoroState.totalSessionsToday++
    logActivity('focus_minutes', { minutes: db.pomodoroState.currentSession.durationMinutes })
  }
  db.pomodoroState.isRunning = false
  db.pomodoroState.currentSession = null
  saveDatabase()
  return db.pomodoroState
}

export function startBreak(type: 'short_break' | 'long_break'): PomodoroState {
  const duration = type === 'short_break' ? 5 : 15
  db.pomodoroState.isRunning = true
  db.pomodoroState.currentSession = {
    taskId: null,
    taskTitle: type === 'short_break' ? 'Short Break' : 'Long Break',
    startedAt: new Date().toISOString(),
    durationMinutes: duration,
    type
  }
  saveDatabase()
  return db.pomodoroState
}

export function stopPomodoro(): PomodoroState {
  db.pomodoroState.isRunning = false
  db.pomodoroState.currentSession = null
  saveDatabase()
  return db.pomodoroState
}

// Pomodoro History functions
export function savePomodoroSession(record: Omit<PomodoroHistoryRecord, 'id'>): PomodoroHistoryRecord {
  const entry: PomodoroHistoryRecord = {
    ...record,
    id: generateId()
  }
  db.pomodoroHistory.push(entry)
  saveDatabase()
  return entry
}

export function getPomodoroStats(): {
  todaySessions: number
  todayMinutes: number
  weekSessions: number
  weekMinutes: number
  streak: number
  mostFocusedTask: string | null
} {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Week start (Monday)
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  const weekStart = monday.toISOString().split('T')[0]

  const workSessions = (db.pomodoroHistory || []).filter(s => s.type === 'work')

  // Today
  const todaySessions = workSessions.filter(s => s.completedAt.startsWith(today))
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0)

  // This week
  const weekSessions = workSessions.filter(s => s.completedAt >= weekStart + 'T00:00:00')
  const weekMinutes = weekSessions.reduce((sum, s) => sum + s.durationMinutes, 0)

  // Streak: consecutive days with at least 1 work session
  const sessionDates = new Set(workSessions.map(s => s.completedAt.split('T')[0]))
  let streak = 0
  const checkDate = new Date(now)
  // Start from today and go backwards
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0]
    if (sessionDates.has(dateStr)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (streak === 0 && dateStr === today) {
      // Today has no sessions yet, check yesterday
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  // Most focused task this week (by session count)
  const taskCounts = new Map<string, number>()
  weekSessions.forEach(s => {
    if (s.taskTitle && s.taskTitle !== 'Free Focus') {
      taskCounts.set(s.taskTitle, (taskCounts.get(s.taskTitle) || 0) + 1)
    }
  })
  let mostFocusedTask: string | null = null
  let maxCount = 0
  taskCounts.forEach((count, title) => {
    if (count > maxCount) {
      maxCount = count
      mostFocusedTask = title
    }
  })

  return {
    todaySessions: todaySessions.length,
    todayMinutes,
    weekSessions: weekSessions.length,
    weekMinutes,
    streak,
    mostFocusedTask
  }
}

// Morning Briefing functions
export function getMorningBriefing(date: string): MorningBriefing | null {
  return db.morningBriefings.find(b => b.date === date) || null
}

export function saveMorningBriefing(briefing: MorningBriefing): MorningBriefing {
  const existingIndex = db.morningBriefings.findIndex(b => b.date === briefing.date)
  if (existingIndex !== -1) {
    db.morningBriefings[existingIndex] = briefing
  } else {
    db.morningBriefings.push(briefing)
  }
  saveDatabase()
  return briefing
}

export function dismissMorningBriefing(date: string): void {
  const briefing = db.morningBriefings.find(b => b.date === date)
  if (briefing) {
    briefing.dismissed = true
    saveDatabase()
  }
}

export function getBriefingData(): {
  overdueTasks: Task[]
  todayTasks: Task[]
  highPriorityTasks: Task[]
  stats: Stats
  recentNotes: DailyNote[]
  streak: number
} {
  const today = new Date().toISOString().split('T')[0]
  const overdueTasks = db.tasks.filter(t => !t.completed && t.due_date && t.due_date < today)
  const todayTasks = db.tasks.filter(t => !t.completed && t.due_date === today)
  const highPriorityTasks = db.tasks.filter(t => !t.completed && t.priority === 1)
  const recentNotes = db.dailyNotes
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)

  return {
    overdueTasks,
    todayTasks,
    highPriorityTasks,
    stats: db.stats,
    recentNotes,
    streak: db.stats.currentStreak
  }
}

// Weekly Review functions
export function getWeeklyReview(weekStart: string): WeeklyReview | null {
  return db.weeklyReviews.find(r => r.weekStartDate === weekStart) || null
}

export function saveWeeklyReview(review: WeeklyReview): WeeklyReview {
  const existingIndex = db.weeklyReviews.findIndex(r => r.weekStartDate === review.weekStartDate)
  if (existingIndex !== -1) {
    db.weeklyReviews[existingIndex] = review
  } else {
    db.weeklyReviews.push(review)
  }
  saveDatabase()
  return review
}

export function getAllWeeklyReviews(): WeeklyReview[] {
  return db.weeklyReviews.sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
}

export function getWeeklyReviewData(weekStart: string): {
  completedTasks: Task[]
  focusMinutes: number
  notesWritten: DailyNote[]
  categoriesWorked: string[]
  streak: number
} {
  const weekEnd = new Date(weekStart + 'T00:00:00')
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  const completedTasks = db.tasks.filter(t =>
    t.completed && t.updated_at && t.updated_at >= weekStart && t.updated_at < weekEndStr
  )

  const weekActivity = db.activityLog.filter(e => e.date >= weekStart && e.date < weekEndStr)
  const focusMinutes = weekActivity.reduce((sum, e) => sum + e.focusMinutes, 0)
  const categoriesWorked = [...new Set(weekActivity.flatMap(e => e.categoriesWorked))]

  const notesWritten = db.dailyNotes.filter(n => n.date >= weekStart && n.date < weekEndStr)

  return {
    completedTasks,
    focusMinutes,
    notesWritten,
    categoriesWorked,
    streak: db.stats.currentStreak
  }
}

export function checkWeeklyReviewNeeded(): { needed: boolean; weekStart: string } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  // Check on Sunday (0) if review exists for the past week (Monday start)
  const lastMonday = new Date(now)
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  lastMonday.setDate(lastMonday.getDate() - diff)
  const weekStartStr = lastMonday.toISOString().split('T')[0]
  const existing = db.weeklyReviews.find(r => r.weekStartDate === weekStartStr)
  return { needed: dayOfWeek === 0 && !existing, weekStart: weekStartStr }
}

// Chat Conversation CRUD
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function getChatConversations(): ChatConversation[] {
  return (db.chatConversations || [])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getChatConversation(id: string): ChatConversation | null {
  return db.chatConversations.find(c => c.id === id) || null
}

export function createChatConversation(title: string): ChatConversation {
  const conv: ChatConversation = {
    id: generateId(),
    title,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.chatConversations.push(conv)
  saveDatabase()
  return conv
}

export function addChatMessage(conversationId: string, message: ChatMessage): ChatConversation | null {
  const conv = db.chatConversations.find(c => c.id === conversationId)
  if (!conv) return null
  conv.messages.push(message)
  conv.updatedAt = new Date().toISOString()
  saveDatabase()
  return conv
}

export function deleteChatConversation(id: string): void {
  db.chatConversations = db.chatConversations.filter(c => c.id !== id)
  saveDatabase()
}

export function renameChatConversation(id: string, title: string): ChatConversation | null {
  const conv = db.chatConversations.find(c => c.id === id)
  if (!conv) return null
  conv.title = title
  conv.updatedAt = new Date().toISOString()
  saveDatabase()
  return conv
}

export function getChatSettings(): ChatSettings {
  return db.chatSettings
}

export function saveChatSettings(updates: Partial<ChatSettings>): ChatSettings {
  if (updates.model !== undefined) db.chatSettings.model = updates.model
  if (updates.systemPromptMode !== undefined) db.chatSettings.systemPromptMode = updates.systemPromptMode
  if (updates.maxTokens !== undefined) db.chatSettings.maxTokens = updates.maxTokens
  if (updates.customSystemPrompt !== undefined) db.chatSettings.customSystemPrompt = updates.customSystemPrompt
  saveDatabase()
  return db.chatSettings
}

// Tweet Draft CRUD
export function getTweetDrafts(): TweetDraft[] {
  return (db.tweetDrafts || [])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getTweetDraft(id: string): TweetDraft | null {
  return db.tweetDrafts.find(d => d.id === id) || null
}

export function createTweetDraft(topic?: string): TweetDraft {
  const draft: TweetDraft = {
    id: generateId(),
    text: '',
    segments: [''],
    isThread: false,
    status: 'draft',
    topic: topic || undefined,
    aiHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    threadTweetIds: []
  }
  db.tweetDrafts.push(draft)
  saveDatabase()
  return draft
}

export function updateTweetDraft(id: string, updates: Partial<TweetDraft>): TweetDraft | null {
  const draft = db.tweetDrafts.find(d => d.id === id)
  if (!draft) return null
  if (updates.text !== undefined) draft.text = updates.text
  if (updates.segments !== undefined) draft.segments = updates.segments
  if (updates.isThread !== undefined) draft.isThread = updates.isThread
  if (updates.status !== undefined) draft.status = updates.status
  if (updates.topic !== undefined) draft.topic = updates.topic
  if (updates.postedAt !== undefined) draft.postedAt = updates.postedAt
  if (updates.tweetId !== undefined) draft.tweetId = updates.tweetId
  if (updates.threadTweetIds !== undefined) draft.threadTweetIds = updates.threadTweetIds
  draft.updatedAt = new Date().toISOString()
  saveDatabase()
  return draft
}

export function addTweetAIMessage(draftId: string, msg: TweetAIMessage): TweetDraft | null {
  const draft = db.tweetDrafts.find(d => d.id === draftId)
  if (!draft) return null
  draft.aiHistory.push(msg)
  draft.updatedAt = new Date().toISOString()
  saveDatabase()
  return draft
}

export function deleteTweetDraft(id: string): void {
  db.tweetDrafts = db.tweetDrafts.filter(d => d.id !== id)
  saveDatabase()
}

// Tweet Persona CRUD
export function getTweetPersonas(): TweetPersona[] {
  return db.tweetPersonas || []
}

export function createTweetPersona(data: { name: string; description: string; exampleTweets: string[] }): TweetPersona {
  const persona: TweetPersona = {
    id: generateId(),
    name: data.name,
    description: data.description,
    exampleTweets: data.exampleTweets,
    isBuiltIn: false,
    createdAt: new Date().toISOString()
  }
  db.tweetPersonas.push(persona)
  saveDatabase()
  return persona
}

export function deleteTweetPersona(id: string): void {
  db.tweetPersonas = db.tweetPersonas.filter(p => p.id !== id)
  saveDatabase()
}

// AI Tasks CRUD
export function getAITasks(): AITask[] {
  return db.aiTasks || []
}

export function createAITask(data: { title: string; description: string; priority: 'low' | 'medium' | 'high'; tags: string[] }): AITask {
  const task: AITask = {
    id: generateId(),
    title: data.title,
    description: data.description,
    column: 'backlog',
    priority: data.priority,
    tags: data.tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.aiTasks.push(task)
  saveDatabase()
  syncAITasksFile()
  return task
}

export function updateAITask(id: string, updates: Partial<AITask>): AITask | null {
  const task = db.aiTasks.find(t => t.id === id)
  if (!task) return null
  if (updates.title !== undefined) task.title = updates.title
  if (updates.description !== undefined) task.description = updates.description
  if (updates.priority !== undefined) task.priority = updates.priority
  if (updates.tags !== undefined) task.tags = updates.tags
  if (updates.column !== undefined) task.column = updates.column
  task.updatedAt = new Date().toISOString()
  saveDatabase()
  syncAITasksFile()
  return task
}

export function deleteAITask(id: string): void {
  db.aiTasks = db.aiTasks.filter(t => t.id !== id)
  saveDatabase()
  syncAITasksFile()
}

export function moveAITask(id: string, column: AITask['column']): AITask | null {
  const task = db.aiTasks.find(t => t.id === id)
  if (!task) return null
  task.column = column
  task.updatedAt = new Date().toISOString()
  saveDatabase()
  syncAITasksFile()
  return task
}

// Memory CRUD
export function getMemories(): Memory[] {
  return (db.memories || [])
    .filter(m => !m.isArchived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getAllMemories(): Memory[] {
  return db.memories || []
}

export function createMemory(data: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Memory {
  const memory: Memory = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.memories.push(memory)
  updateTopicCounts()
  saveDatabase()
  return memory
}

export function updateMemory(id: string, updates: Partial<Memory>): Memory | null {
  const mem = db.memories.find(m => m.id === id)
  if (!mem) return null
  if (updates.title !== undefined) mem.title = updates.title
  if (updates.content !== undefined) mem.content = updates.content
  if (updates.topics !== undefined) mem.topics = updates.topics
  if (updates.importance !== undefined) mem.importance = updates.importance
  if (updates.isPinned !== undefined) mem.isPinned = updates.isPinned
  if (updates.isArchived !== undefined) mem.isArchived = updates.isArchived
  if (updates.relatedMemoryIds !== undefined) mem.relatedMemoryIds = updates.relatedMemoryIds
  if (updates.sourcePreview !== undefined) mem.sourcePreview = updates.sourcePreview
  mem.updatedAt = new Date().toISOString()
  updateTopicCounts()
  saveDatabase()
  return mem
}

export function deleteMemory(id: string): void {
  db.memories = db.memories.filter(m => m.id !== id)
  // Remove from relatedMemoryIds of other memories
  db.memories.forEach(m => {
    m.relatedMemoryIds = m.relatedMemoryIds.filter(rid => rid !== id)
  })
  updateTopicCounts()
  saveDatabase()
}

export function archiveMemory(id: string): Memory | null {
  const mem = db.memories.find(m => m.id === id)
  if (!mem) return null
  mem.isArchived = !mem.isArchived
  mem.updatedAt = new Date().toISOString()
  updateTopicCounts()
  saveDatabase()
  return mem
}

export function pinMemory(id: string): Memory | null {
  const mem = db.memories.find(m => m.id === id)
  if (!mem) return null
  mem.isPinned = !mem.isPinned
  mem.updatedAt = new Date().toISOString()
  saveDatabase()
  return mem
}

export function getMemoryTopics(): MemoryTopic[] {
  return db.memoryTopics || []
}

export function updateMemoryTopics(topics: MemoryTopic[]): MemoryTopic[] {
  db.memoryTopics = topics
  saveDatabase()
  return db.memoryTopics
}

export function getMemorySettings(): MemorySettings {
  return db.memorySettings
}

export function saveMemorySettings(updates: Partial<MemorySettings>): MemorySettings {
  if (updates.autoGenerate !== undefined) db.memorySettings.autoGenerate = updates.autoGenerate
  if (updates.maxMemoriesInContext !== undefined) db.memorySettings.maxMemoriesInContext = updates.maxMemoriesInContext
  if (updates.tokenBudget !== undefined) db.memorySettings.tokenBudget = updates.tokenBudget
  saveDatabase()
  return db.memorySettings
}

// LLM Settings
export function getLLMSettings(): LLMSettings {
  return db.llmSettings
}

export function saveLLMSettings(updates: Partial<LLMSettings>): LLMSettings {
  if (updates.provider !== undefined) db.llmSettings.provider = updates.provider
  if (updates.geminiApiKey !== undefined) db.llmSettings.geminiApiKey = updates.geminiApiKey
  if (updates.groqApiKey !== undefined) db.llmSettings.groqApiKey = updates.groqApiKey
  if (updates.openrouterApiKey !== undefined) db.llmSettings.openrouterApiKey = updates.openrouterApiKey
  if (updates.primaryModel !== undefined) db.llmSettings.primaryModel = updates.primaryModel
  if (updates.fastModel !== undefined) db.llmSettings.fastModel = updates.fastModel
  saveDatabase()
  return db.llmSettings
}

// Welcome modal
export function isWelcomeDismissed(): boolean {
  return db.welcomeDismissed || false
}

export function dismissWelcome(): void {
  db.welcomeDismissed = true
  saveDatabase()
}

// CLI Mode
export function getUseCliMode(): boolean {
  return db.useCliMode || false
}

export function setUseCliMode(enabled: boolean): boolean {
  db.useCliMode = enabled
  saveDatabase()
  return db.useCliMode
}

function updateTopicCounts(): void {
  const topicMap = new Map<string, number>()
  const activeMemories = db.memories.filter(m => !m.isArchived)
  activeMemories.forEach(m => {
    m.topics.forEach(t => {
      topicMap.set(t, (topicMap.get(t) || 0) + 1)
    })
  })
  // Merge with existing topic colors
  const existingTopics = new Map(db.memoryTopics.map(t => [t.name, t.color]))
  const defaultColors = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#22d3ee', '#fb923c']
  let colorIdx = 0
  db.memoryTopics = Array.from(topicMap.entries()).map(([name, count]) => ({
    name,
    color: existingTopics.get(name) || defaultColors[colorIdx++ % defaultColors.length],
    memoryCount: count
  }))
}

function syncAITasksFile(): void {
  try {
    const homeDir = process.env.USERPROFILE || process.env.HOME || ''
    const claudeDir = path.join(homeDir, '.claude')
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true })
    }
    const filePath = path.join(claudeDir, 'ai-tasks.md')

    const columns: { key: AITask['column']; label: string }[] = [
      { key: 'backlog', label: 'Backlog' },
      { key: 'todo', label: 'Todo' },
      { key: 'in_progress', label: 'In Progress' },
      { key: 'done', label: 'Done' }
    ]

    let content = '# AI Tasks & Ideas\n'

    for (const col of columns) {
      content += `\n## ${col.label}\n`
      const tasks = (db.aiTasks || []).filter(t => t.column === col.key)
      if (tasks.length === 0) {
        content += '\n_No tasks_\n'
      } else {
        for (const task of tasks) {
          const tags = task.tags.length > 0 ? ' ' + task.tags.map(t => `\`#${t}\``).join(' ') : ''
          if (col.key === 'done') {
            const completedDate = task.updatedAt.split('T')[0]
            content += `- **${task.title}**${task.description ? ' — ' + task.description : ''} (completed ${completedDate})${tags}\n`
          } else {
            content += `- [${task.priority}] **${task.title}**${task.description ? ' — ' + task.description : ''}${tags}\n`
          }
        }
      }
    }

    fs.writeFileSync(filePath, content, 'utf-8')
  } catch {
    // Silently fail — file sync is best-effort
  }
}

// Roadmap Goals CRUD
export function getRoadmapGoals(): RoadmapGoal[] {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return (db.roadmapGoals || []).sort((a, b) => {
    if (a.targetYear !== b.targetYear) return a.targetYear - b.targetYear
    if (a.targetQuarter !== b.targetQuarter) return a.targetQuarter - b.targetQuarter
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

export function createRoadmapGoal(data: Omit<RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'>): RoadmapGoal {
  const goal: RoadmapGoal = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.roadmapGoals.push(goal)
  saveDatabase()
  syncRoadmapFiles()
  return goal
}

export function updateRoadmapGoal(id: string, updates: Partial<RoadmapGoal>): RoadmapGoal | null {
  const goal = db.roadmapGoals.find(g => g.id === id)
  if (!goal) return null
  if (updates.title !== undefined) goal.title = updates.title
  if (updates.description !== undefined) goal.description = updates.description
  if (updates.category !== undefined) goal.category = updates.category
  if (updates.targetQuarter !== undefined) goal.targetQuarter = updates.targetQuarter
  if (updates.targetYear !== undefined) goal.targetYear = updates.targetYear
  if (updates.priority !== undefined) goal.priority = updates.priority
  if (updates.status !== undefined) goal.status = updates.status
  if (updates.research_questions !== undefined) goal.research_questions = updates.research_questions
  if (updates.guidance_needed !== undefined) goal.guidance_needed = updates.guidance_needed
  if (updates.notes !== undefined) goal.notes = updates.notes
  if (updates.sub_goals !== undefined) goal.sub_goals = updates.sub_goals
  if (updates.tags !== undefined) goal.tags = updates.tags
  if (updates.topicReports !== undefined) goal.topicReports = updates.topicReports
  if (updates.personalContext !== undefined) goal.personalContext = updates.personalContext
  if (updates.contextFiles !== undefined) goal.contextFiles = updates.contextFiles
  if ((updates as any).activityLog !== undefined) (goal as any).activityLog = (updates as any).activityLog
  goal.updatedAt = new Date().toISOString()
  saveDatabase()
  syncRoadmapFiles()
  return goal
}

export function addGoalActivity(goalId: string, type: string, description: string): void {
  const goal = db.roadmapGoals.find(g => g.id === goalId)
  if (!goal) return
  const log = ((goal as any).activityLog || []) as { id: string; type: string; description: string; timestamp: string }[]
  log.unshift({
    id: crypto.randomUUID(),
    type,
    description,
    timestamp: new Date().toISOString(),
  })
  if (log.length > 50) log.length = 50;
  (goal as any).activityLog = log
  saveDatabase()
}

export function deleteRoadmapGoal(id: string): void {
  db.roadmapGoals = db.roadmapGoals.filter(g => g.id !== id)
  saveDatabase()
  syncRoadmapFiles()
}

function escapeYaml(str: string): string {
  if (!str) return '""'
  if (/[:\-#{}\[\],&*?|>!%@`"']/.test(str) || str.includes('\n') || str.startsWith(' ') || str.endsWith(' ')) {
    return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"'
  }
  return str
}

function syncRoadmapFiles(): void {
  try {
    const homeDir = process.env.USERPROFILE || process.env.HOME || ''
    const claudeDir = path.join(homeDir, '.claude')
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true })
    }

    const goals = getRoadmapGoals()

    // Write YAML
    let yaml = 'goals:\n'
    for (const g of goals) {
      yaml += `  - id: ${escapeYaml(g.id)}\n`
      yaml += `    title: ${escapeYaml(g.title)}\n`
      yaml += `    category: ${g.category}\n`
      yaml += `    target: Q${g.targetQuarter} ${g.targetYear}\n`
      yaml += `    priority: ${g.priority}\n`
      yaml += `    status: ${g.status}\n`
      if (g.description) {
        yaml += `    description: ${escapeYaml(g.description)}\n`
      }
      if (g.research_questions.length > 0) {
        yaml += `    research_questions:\n`
        for (const q of g.research_questions) {
          yaml += `      - ${escapeYaml(q)}\n`
        }
      }
      if (g.guidance_needed.length > 0) {
        yaml += `    guidance_needed:\n`
        for (const gn of g.guidance_needed) {
          yaml += `      - ${escapeYaml(gn)}\n`
        }
      }
      if (g.sub_goals.length > 0) {
        yaml += `    sub_goals:\n`
        for (const sg of g.sub_goals) {
          yaml += `      - title: ${escapeYaml(sg.title)}\n`
          yaml += `        status: ${sg.status}\n`
        }
      }
      if (g.tags.length > 0) {
        yaml += `    tags: [${g.tags.map(t => escapeYaml(t)).join(', ')}]\n`
      }
      if (g.notes) {
        yaml += `    notes: ${escapeYaml(g.notes)}\n`
      }
    }
    fs.writeFileSync(path.join(claudeDir, 'roadmap.yaml'), yaml, 'utf-8')

    // Write Markdown
    const statusIcon: Record<string, string> = { not_started: ' ', in_progress: '~', completed: 'x', on_hold: '-' }
    let md = '# Life Roadmap\n'
    const byYear = new Map<number, RoadmapGoal[]>()
    for (const g of goals) {
      if (!byYear.has(g.targetYear)) byYear.set(g.targetYear, [])
      byYear.get(g.targetYear)!.push(g)
    }
    for (const [year, yearGoals] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
      md += `\n## ${year}\n`
      const byQ = new Map<number, RoadmapGoal[]>()
      for (const g of yearGoals) {
        if (!byQ.has(g.targetQuarter)) byQ.set(g.targetQuarter, [])
        byQ.get(g.targetQuarter)!.push(g)
      }
      for (const [q, qGoals] of [...byQ.entries()].sort((a, b) => a[0] - b[0])) {
        md += `\n### Q${q} ${year}\n\n`
        for (const g of qGoals) {
          md += `- [${statusIcon[g.status] || ' '}] **${g.title}** _(${g.category}, ${g.priority} priority)_\n`
          if (g.description) {
            md += `  ${g.description}\n`
          }
          for (const sg of g.sub_goals) {
            md += `  - [${statusIcon[sg.status] || ' '}] ${sg.title}\n`
          }
          if (g.research_questions.length > 0) {
            md += `  - **Research needed:**\n`
            for (const rq of g.research_questions) {
              md += `    - ${rq}\n`
            }
          }
          if (g.guidance_needed.length > 0) {
            md += `  - **Guidance needed:**\n`
            for (const gn of g.guidance_needed) {
              md += `    - ${gn}\n`
            }
          }
        }
      }
    }
    fs.writeFileSync(path.join(claudeDir, 'roadmap.md'), md, 'utf-8')
  } catch {
    // Silently fail — file sync is best-effort
  }
}

// Master Plan CRUD
export function getMasterPlan(): Database['masterPlan'] {
  return db.masterPlan || null
}

export function saveMasterPlan(plan: NonNullable<Database['masterPlan']>): NonNullable<Database['masterPlan']> {
  db.masterPlan = plan
  saveDatabase()
  return plan
}

export function clearMasterPlan(): void {
  db.masterPlan = null
  saveDatabase()
}

// Master Plan Tasks CRUD
export function getMasterPlanTasks(planDate?: string): MasterPlanTask[] {
  const tasks = db.masterPlanTasks || []
  if (planDate) return tasks.filter(t => t.planDate === planDate)
  return tasks
}

export function createMasterPlanTask(data: Omit<MasterPlanTask, 'id' | 'createdAt'>): MasterPlanTask {
  const task: MasterPlanTask = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString()
  }
  db.masterPlanTasks.push(task)
  saveDatabase()
  return task
}

export function updateMasterPlanTask(id: string, updates: Partial<MasterPlanTask>): MasterPlanTask | null {
  const task = db.masterPlanTasks.find(t => t.id === id)
  if (!task) return null
  if (updates.status !== undefined) task.status = updates.status
  if (updates.launchedAt !== undefined) task.launchedAt = updates.launchedAt
  if (updates.completedAt !== undefined) task.completedAt = updates.completedAt
  if (updates.sessionId !== undefined) task.sessionId = updates.sessionId
  saveDatabase()
  return task
}

export function clearMasterPlanTasks(planDate: string): void {
  db.masterPlanTasks = db.masterPlanTasks.filter(t => t.planDate !== planDate)
  saveDatabase()
}

// Bank Sync CRUD
export function getBankConnections(): BankConnection[] {
  return db.bankConnections || []
}

export function getBankConnection(id: string): BankConnection | null {
  return db.bankConnections.find(c => c.id === id) || null
}

export function createBankConnection(provider: 'simplefin' | 'teller', accessToken: string): BankConnection {
  const now = new Date().toISOString()
  const conn: BankConnection = {
    id: crypto.randomUUID(),
    provider,
    accessToken,
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
  db.bankConnections.push(conn)
  saveDatabase()
  return conn
}

export function updateBankConnection(id: string, updates: Partial<BankConnection>): BankConnection | null {
  const idx = db.bankConnections.findIndex(c => c.id === id)
  if (idx === -1) return null
  db.bankConnections[idx] = { ...db.bankConnections[idx], ...updates, updatedAt: new Date().toISOString() }
  saveDatabase()
  return db.bankConnections[idx]
}

export function deleteBankConnection(id: string): void {
  db.bankConnections = db.bankConnections.filter(c => c.id !== id)
  // Also remove associated accounts and transactions
  const accountIds = db.bankAccounts.filter(a => a.connectionId === id).map(a => a.id)
  db.bankAccounts = db.bankAccounts.filter(a => a.connectionId !== id)
  db.bankTransactions = db.bankTransactions.filter(t => !accountIds.includes(t.accountId))
  saveDatabase()
}

export function getBankAccounts(): BankAccount[] {
  return db.bankAccounts || []
}

export function upsertBankAccount(account: Omit<BankAccount, 'id'> & { id?: string }): BankAccount {
  const idx = db.bankAccounts.findIndex(a => a.connectionId === account.connectionId && a.externalId === account.externalId)
  if (idx !== -1) {
    // Preserve existing ID — never overwrite with a new UUID
    const { id: _ignoreId, ...updates } = account
    db.bankAccounts[idx] = { ...db.bankAccounts[idx], ...updates, lastSynced: new Date().toISOString() }
    saveDatabase()
    return db.bankAccounts[idx]
  }
  // New account — assign stable ID
  const newAccount = { ...account, id: account.id || crypto.randomUUID() } as BankAccount
  db.bankAccounts.push(newAccount)
  saveDatabase()
  return newAccount
}

export function getBankTransactions(accountId?: string, limit: number = 100): BankTransaction[] {
  let txs = db.bankTransactions || []
  if (accountId) txs = txs.filter(t => t.accountId === accountId)
  return txs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

// ── Network CRM CRUD ──

const AVATAR_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#22d3ee', '#fb923c']

function hashNameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function getNetworkContacts(): NetworkContact[] {
  return (db.networkContacts || []).sort((a, b) => a.name.localeCompare(b.name))
}

export function getNetworkContact(id: string): NetworkContact | null {
  return db.networkContacts.find(c => c.id === id) || null
}

export function createNetworkContact(data: Omit<NetworkContact, 'id' | 'createdAt' | 'updatedAt'>): NetworkContact {
  const contact: NetworkContact = {
    ...data,
    id: generateId(),
    avatarColor: data.avatarColor || hashNameToColor(data.name),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.networkContacts.push(contact)
  saveDatabase()
  return contact
}

export function updateNetworkContact(id: string, updates: Partial<NetworkContact>): NetworkContact | null {
  const contact = db.networkContacts.find(c => c.id === id)
  if (!contact) return null
  if (updates.name !== undefined) { contact.name = updates.name; contact.avatarColor = hashNameToColor(updates.name) }
  if (updates.company !== undefined) contact.company = updates.company
  if (updates.role !== undefined) contact.role = updates.role
  if (updates.email !== undefined) contact.email = updates.email
  if (updates.phone !== undefined) contact.phone = updates.phone
  if (updates.socialLinks !== undefined) contact.socialLinks = updates.socialLinks
  if (updates.notes !== undefined) contact.notes = updates.notes
  if (updates.tags !== undefined) contact.tags = updates.tags
  contact.updatedAt = new Date().toISOString()
  saveDatabase()
  return contact
}

export function deleteNetworkContact(id: string): void {
  db.networkContacts = db.networkContacts.filter(c => c.id !== id)
  // Cascade: remove interactions referencing this contact
  db.contactInteractions = db.contactInteractions.filter(i => !i.contactIds.includes(id))
  // Cascade: remove pipeline cards for this contact
  db.pipelineCards = db.pipelineCards.filter(c => c.contactId !== id)
  saveDatabase()
}

export function getContactInteractions(contactId?: string): ContactInteraction[] {
  let interactions = db.contactInteractions || []
  if (contactId) {
    interactions = interactions.filter(i => i.contactIds.includes(contactId))
  }
  return interactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function createContactInteraction(data: Omit<ContactInteraction, 'id' | 'createdAt'>): ContactInteraction {
  const interaction: ContactInteraction = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString()
  }
  db.contactInteractions.push(interaction)
  saveDatabase()
  return interaction
}

export function deleteContactInteraction(id: string): void {
  db.contactInteractions = db.contactInteractions.filter(i => i.id !== id)
  saveDatabase()
}

export function getPipelines(): Pipeline[] {
  return (db.pipelines || []).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function createPipeline(data: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt'>): Pipeline {
  const pipeline: Pipeline = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.pipelines.push(pipeline)
  saveDatabase()
  return pipeline
}

export function updatePipeline(id: string, updates: Partial<Pipeline>): Pipeline | null {
  const pipeline = db.pipelines.find(p => p.id === id)
  if (!pipeline) return null
  if (updates.name !== undefined) pipeline.name = updates.name
  if (updates.stages !== undefined) pipeline.stages = updates.stages
  pipeline.updatedAt = new Date().toISOString()
  saveDatabase()
  return pipeline
}

export function deletePipeline(id: string): void {
  db.pipelines = db.pipelines.filter(p => p.id !== id)
  // Cascade: remove cards in this pipeline
  db.pipelineCards = db.pipelineCards.filter(c => c.pipelineId !== id)
  saveDatabase()
}

export function getPipelineCards(pipelineId?: string): PipelineCard[] {
  let cards = db.pipelineCards || []
  if (pipelineId) {
    cards = cards.filter(c => c.pipelineId === pipelineId)
  }
  return cards.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function createPipelineCard(data: Omit<PipelineCard, 'id' | 'createdAt' | 'updatedAt'>): PipelineCard {
  const card: PipelineCard = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.pipelineCards.push(card)
  saveDatabase()
  return card
}

export function updatePipelineCard(id: string, updates: Partial<PipelineCard>): PipelineCard | null {
  const card = db.pipelineCards.find(c => c.id === id)
  if (!card) return null
  if (updates.title !== undefined) card.title = updates.title
  if (updates.description !== undefined) card.description = updates.description
  if (updates.value !== undefined) card.value = updates.value
  if (updates.stage !== undefined) card.stage = updates.stage
  if (updates.contactId !== undefined) card.contactId = updates.contactId
  card.updatedAt = new Date().toISOString()
  saveDatabase()
  return card
}

export function movePipelineCard(id: string, stage: string): PipelineCard | null {
  const card = db.pipelineCards.find(c => c.id === id)
  if (!card) return null
  card.stage = stage
  card.updatedAt = new Date().toISOString()
  saveDatabase()
  return card
}

export function deletePipelineCard(id: string): void {
  db.pipelineCards = db.pipelineCards.filter(c => c.id !== id)
  saveDatabase()
}

// ── Social Connectors CRUD ──

export function getSocialConnections(): SocialConnection[] {
  return db.socialConnections || []
}

export function getSocialConnection(id: string): SocialConnection | null {
  return (db.socialConnections || []).find(c => c.id === id) || null
}

export function createSocialConnection(data: Omit<SocialConnection, 'id' | 'createdAt' | 'updatedAt'>): SocialConnection {
  const now = new Date().toISOString()
  const conn: SocialConnection = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  db.socialConnections.push(conn)
  saveDatabase()
  return conn
}

export function updateSocialConnection(id: string, updates: Partial<SocialConnection>): SocialConnection | null {
  const conn = db.socialConnections.find(c => c.id === id)
  if (!conn) return null
  if (updates.status !== undefined) conn.status = updates.status
  if (updates.lastSyncAt !== undefined) conn.lastSyncAt = updates.lastSyncAt
  if (updates.credentials !== undefined) conn.credentials = updates.credentials
  if (updates.accountId !== undefined) conn.accountId = updates.accountId
  if (updates.accountName !== undefined) conn.accountName = updates.accountName
  conn.updatedAt = new Date().toISOString()
  saveDatabase()
  return conn
}

export function deleteSocialConnection(id: string): void {
  db.socialConnections = db.socialConnections.filter(c => c.id !== id)
  // Also remove contact mappings for this provider
  const conn = db.socialConnections.find(c => c.id === id)
  // mappings are left intact — they link contacts to external IDs and remain useful
  saveDatabase()
}

export function getContactMappings(contactId?: string): ContactMapping[] {
  let mappings = db.contactMappings || []
  if (contactId) {
    mappings = mappings.filter(m => m.contactId === contactId)
  }
  return mappings
}

export function createContactMapping(data: Omit<ContactMapping, 'id' | 'createdAt'>): ContactMapping {
  const mapping: ContactMapping = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  db.contactMappings.push(mapping)
  saveDatabase()
  return mapping
}

export function deleteContactMapping(id: string): void {
  db.contactMappings = db.contactMappings.filter(m => m.id !== id)
  saveDatabase()
}

// ── Content Drafts CRUD ──

export function getContentDrafts(): ContentDraft[] {
  return (db.contentDrafts || [])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getContentDraft(id: string): ContentDraft | null {
  return db.contentDrafts.find(d => d.id === id) || null
}

export function createContentDraft(topic?: string): ContentDraft {
  const draft: ContentDraft = {
    id: generateId(),
    contentType: 'tweet',
    topic: topic || '',
    research: '',
    outline: '',
    content: '',
    messages: [],
    status: 'researching',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.contentDrafts.push(draft)
  saveDatabase()
  return draft
}

export function updateContentDraft(id: string, updates: Partial<ContentDraft>): ContentDraft | null {
  const draft = db.contentDrafts.find(d => d.id === id)
  if (!draft) return null
  if (updates.contentType !== undefined) draft.contentType = updates.contentType
  if (updates.topic !== undefined) draft.topic = updates.topic
  if (updates.research !== undefined) draft.research = updates.research
  if (updates.outline !== undefined) draft.outline = updates.outline
  if (updates.content !== undefined) draft.content = updates.content
  if (updates.messages !== undefined) draft.messages = updates.messages
  if (updates.status !== undefined) draft.status = updates.status
  if (updates.scores !== undefined) draft.scores = updates.scores
  draft.updatedAt = new Date().toISOString()
  saveDatabase()
  return draft
}

export function updateContentDraftScores(id: string, scores: { index: number; hook: number; clarity: number; viral: number; feedback?: string; strengths?: string[]; weaknesses?: string[] }[]): ContentDraft | null {
  const draft = db.contentDrafts.find(d => d.id === id)
  if (!draft) return null
  draft.scores = scores
  draft.updatedAt = new Date().toISOString()
  saveDatabase()
  return draft
}

export function deleteContentDraft(id: string): void {
  db.contentDrafts = db.contentDrafts.filter(d => d.id !== id)
  saveDatabase()
}

// Tweet Patterns
export function getTweetPatterns(): { id: string; type: 'positive' | 'negative'; pattern: string; avgScore: number; occurrences: number; exampleTweet: string; extractedAt: string }[] {
  return db.tweetPatterns || []
}

export function saveTweetPatterns(patterns: { id: string; type: 'positive' | 'negative'; pattern: string; avgScore: number; occurrences: number; exampleTweet: string; extractedAt: string }[]): void {
  db.tweetPatterns = patterns
  saveDatabase()
}

// Score Snapshots
export function getScoreSnapshots(): { date: string; draftsScored: number; tweetsScored: number; avgHook: number; avgClarity: number; avgViral: number; avgOverall: number; above8Count: number; below5Count: number }[] {
  return (db.scoreSnapshots || []).sort((a, b) => a.date.localeCompare(b.date))
}

export function addScoreSnapshot(snapshot: { date: string; draftsScored: number; tweetsScored: number; avgHook: number; avgClarity: number; avgViral: number; avgOverall: number; above8Count: number; below5Count: number }): void {
  if (!db.scoreSnapshots) db.scoreSnapshots = []
  const idx = db.scoreSnapshots.findIndex(s => s.date === snapshot.date)
  if (idx >= 0) {
    db.scoreSnapshots[idx] = snapshot
  } else {
    db.scoreSnapshots.push(snapshot)
  }
  saveDatabase()
}

// All scored drafts (for pattern extraction)
export function getAllScoredDrafts(): ContentDraft[] {
  return (db.contentDrafts || []).filter(d => d.scores && d.scores.length > 0 && d.content)
}

// Category Overrides
export function getCategoryOverrides(): Record<string, string> {
  return db.categoryOverrides || {}
}

export function setCategoryOverride(transactionId: string, categoryKey: string): Record<string, string> {
  if (!db.categoryOverrides) db.categoryOverrides = {}
  db.categoryOverrides[transactionId] = categoryKey
  saveDatabase()
  return db.categoryOverrides
}

export function removeCategoryOverride(transactionId: string): Record<string, string> {
  if (db.categoryOverrides) {
    delete db.categoryOverrides[transactionId]
    saveDatabase()
  }
  return db.categoryOverrides || {}
}

export function upsertBankTransaction(tx: BankTransaction): { inserted: boolean } {
  const existing = db.bankTransactions.find(t => t.dedupHash === tx.dedupHash)
  if (existing) {
    // Update existing — only refresh metadata
    Object.assign(existing, { pending: tx.pending, description: tx.description, category: tx.category, merchant: tx.merchant })
    saveDatabase()
    return { inserted: false }
  }
  db.bankTransactions.push(tx)
  saveDatabase()
  return { inserted: true }
}

// Calendar Event CRUD

function expandRecurringEvents(startDate: string, endDate: string): CalendarEvent[] {
  const results: CalendarEvent[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  for (const event of db.calendarEvents) {
    if (event.recurrence === 'weekly') {
      // Generate occurrences from event.date through endDate
      const eventStart = new Date(event.date + 'T00:00:00')
      const cursor = new Date(eventStart)
      // Advance cursor to first occurrence >= startDate
      while (cursor < start) cursor.setDate(cursor.getDate() + 7)
      while (cursor <= end) {
        const occDate = cursor.toISOString().split('T')[0]
        results.push({ ...event, date: occDate })
        cursor.setDate(cursor.getDate() + 7)
      }
    } else if (event.date >= startDate && event.date <= endDate) {
      results.push(event)
    }
  }
  return results.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

export function getCalendarEvents(startDate: string, endDate: string): CalendarEvent[] {
  return expandRecurringEvents(startDate, endDate)
}

export function getCalendarEventsForDate(date: string): CalendarEvent[] {
  return expandRecurringEvents(date, date)
}

export function createCalendarEvent(data: Omit<CalendarEvent, 'id' | 'createdAt'>): CalendarEvent {
  const event: CalendarEvent = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  db.calendarEvents.push(event)
  saveDatabase()
  return event
}

export function updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): CalendarEvent | null {
  const event = db.calendarEvents.find(e => e.id === id)
  if (!event || event.source === 'gcal') return null
  Object.assign(event, updates, { id: event.id, createdAt: event.createdAt })
  saveDatabase()
  return event
}

export function deleteCalendarEvent(id: string): void {
  const event = db.calendarEvents.find(e => e.id === id)
  if (!event || event.source === 'gcal') return
  db.calendarEvents = db.calendarEvents.filter(e => e.id !== id)
  saveDatabase()
}

export function getDailyAgenda(date: string): { tasks: Task[]; events: CalendarEvent[] } {
  const tasks = db.tasks.filter(t => !t.completed && t.due_date === date)
    .sort((a, b) => a.priority - b.priority)
  const events = expandRecurringEvents(date, date)
  return { tasks, events }
}

export function upsertGcalEvent(gcalEventId: string, data: Omit<CalendarEvent, 'id' | 'createdAt' | 'source' | 'gcalEventId'>): CalendarEvent {
  const existing = db.calendarEvents.find(e => e.gcalEventId === gcalEventId)
  if (existing) {
    Object.assign(existing, data)
    saveDatabase()
    return existing
  }
  const event: CalendarEvent = {
    ...data,
    id: crypto.randomUUID(),
    source: 'gcal',
    gcalEventId,
    createdAt: new Date().toISOString(),
  }
  db.calendarEvents.push(event)
  saveDatabase()
  return event
}

export function getCalendarHistory(query?: string, limit: number = 50): { tasks: Task[]; events: CalendarEvent[] } {
  const q = (query || '').toLowerCase().trim()

  // Completed tasks, most recent first
  let tasks = db.tasks
    .filter(t => t.completed)
    .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))

  // Past non-recurring events (date < today)
  const today = new Date().toISOString().split('T')[0]
  let events = db.calendarEvents
    .filter(e => !e.recurrence && e.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))

  if (q) {
    tasks = tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    )
    events = events.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    )
  }

  return { tasks: tasks.slice(0, limit), events: events.slice(0, limit) }
}

export function getLastDailyNotifDate(): string {
  return db.lastDailyNotifDate || ''
}

export function setLastDailyNotifDate(date: string): void {
  db.lastDailyNotifDate = date
  saveDatabase()
}

// Routine CRUD
export function getRoutines(): Routine[] {
  return db.routines || []
}

export function getRoutine(id: string): Routine | null {
  return (db.routines || []).find(r => r.id === id) || null
}

export function createRoutine(data: Omit<Routine, 'id' | 'createdAt'>): Routine {
  const routine: Routine = {
    ...data,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
  }
  db.routines.push(routine)
  saveDatabase()
  return routine
}

export function updateRoutine(id: string, updates: Partial<Routine>): Routine | null {
  const idx = db.routines.findIndex(r => r.id === id)
  if (idx === -1) return null
  db.routines[idx] = { ...db.routines[idx], ...updates, id }
  saveDatabase()
  return db.routines[idx]
}

export function deleteRoutine(id: string): void {
  db.routines = db.routines.filter(r => r.id !== id)
  db.routineResults = db.routineResults.filter(r => r.routineId !== id)
  saveDatabase()
}

export function setRoutineLastRun(id: string, timestamp: string): void {
  const routine = db.routines.find(r => r.id === id)
  if (routine) {
    routine.lastRun = timestamp
    saveDatabase()
  }
}

// RoutineResult CRUD
export function getRoutineResults(routineId?: string, date?: string, limit: number = 50): RoutineResult[] {
  let results = db.routineResults || []
  if (routineId) results = results.filter(r => r.routineId === routineId)
  if (date) results = results.filter(r => r.date === date)
  return results
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)
}

export function getRoutineResultsForDate(date: string): RoutineResult[] {
  return (db.routineResults || [])
    .filter(r => r.date === date)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export function saveRoutineResult(result: Omit<RoutineResult, 'id'>): RoutineResult {
  const entry: RoutineResult = {
    ...result,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
  }
  db.routineResults.push(entry)
  // Cap at 500 entries to prevent unbounded growth
  if (db.routineResults.length > 500) {
    db.routineResults = db.routineResults
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 500)
  }
  saveDatabase()
  return entry
}

export function deleteRoutineResult(id: string): void {
  db.routineResults = db.routineResults.filter(r => r.id !== id)
  saveDatabase()
}

// ===== Agent Orchestration CRUD =====

export function getAgents(): Agent[] {
  return db.agents || []
}

export function getAgent(id: string): Agent | null {
  return (db.agents || []).find(a => a.id === id) || null
}

export function createAgent(data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'spentMonthlyCents' | 'budgetResetDate' | 'status'>): Agent {
  const now = new Date().toISOString()
  const firstOfMonth = now.slice(0, 8) + '01'
  const agent: Agent = {
    ...data,
    id: generateId(),
    spentMonthlyCents: 0,
    budgetResetDate: firstOfMonth,
    status: 'idle',
    createdAt: now,
    updatedAt: now,
  }
  db.agents.push(agent)
  saveDatabase()
  return agent
}

export function updateAgent(id: string, updates: Partial<Agent>): Agent | null {
  const agent = db.agents.find(a => a.id === id)
  if (!agent) return null
  Object.assign(agent, updates, { updatedAt: new Date().toISOString() })
  saveDatabase()
  return agent
}

export function deleteAgent(id: string): void {
  db.agents = db.agents.filter(a => a.id !== id)
  db.agentIssues = db.agentIssues.filter(i => i.assignedAgentId !== id)
  db.heartbeatRuns = db.heartbeatRuns.filter(r => r.agentId !== id)
  db.costEvents = db.costEvents.filter(e => e.agentId !== id)
  db.agentEvents = db.agentEvents.filter(e => e.agentId !== id)
  saveDatabase()
}

export function setAgentStatus(id: string, status: Agent['status'], lastError?: string): Agent | null {
  const agent = db.agents.find(a => a.id === id)
  if (!agent) return null
  agent.status = status
  if (lastError !== undefined) agent.lastError = lastError
  agent.updatedAt = new Date().toISOString()
  saveDatabase()
  return agent
}

// Agent Issues

export function getAgentIssues(filters?: { agentId?: string; status?: AgentIssue['status'] }): AgentIssue[] {
  let issues = db.agentIssues || []
  if (filters?.agentId) issues = issues.filter(i => i.assignedAgentId === filters.agentId)
  if (filters?.status) issues = issues.filter(i => i.status === filters.status)
  return issues.sort((a, b) => {
    const prio = { critical: 0, high: 1, medium: 2, low: 3 }
    return (prio[a.priority] ?? 2) - (prio[b.priority] ?? 2)
  })
}

export function getAgentIssue(id: string): AgentIssue | null {
  return (db.agentIssues || []).find(i => i.id === id) || null
}

export function createAgentIssue(data: Omit<AgentIssue, 'id' | 'createdAt' | 'updatedAt'>): AgentIssue {
  const now = new Date().toISOString()
  // Auto-estimate complexity if not provided
  let estimatedComplexity = data.estimatedComplexity
  if (!estimatedComplexity) {
    const desc = data.description || ''
    if (desc.length > 500 || data.priority === 'critical' || (data.blockedBy && data.blockedBy.length > 0)) {
      estimatedComplexity = 'L'
    } else if (desc.length < 100 && data.tags.length === 0) {
      estimatedComplexity = 'S'
    } else {
      estimatedComplexity = 'M'
    }
  }
  const issue: AgentIssue = {
    ...data,
    estimatedComplexity,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }
  db.agentIssues.push(issue)
  saveDatabase()
  return issue
}

export function updateAgentIssue(id: string, updates: Partial<AgentIssue>): AgentIssue | null {
  const issue = db.agentIssues.find(i => i.id === id)
  if (!issue) return null
  Object.assign(issue, updates, { updatedAt: new Date().toISOString() })
  saveDatabase()
  return issue
}

export function deleteAgentIssue(id: string): void {
  db.agentIssues = db.agentIssues.filter(i => i.id !== id)
  saveDatabase()
}

export function getAgentIssuesByAgent(agentId: string): AgentIssue[] {
  return getAgentIssues({ agentId })
}

// Heartbeat Runs

export function getHeartbeatRuns(filters?: { agentId?: string; issueId?: string; limit?: number }): HeartbeatRun[] {
  let runs = db.heartbeatRuns || []
  if (filters?.agentId) runs = runs.filter(r => r.agentId === filters.agentId)
  if (filters?.issueId) runs = runs.filter(r => r.issueId === filters.issueId)
  runs = runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (filters?.limit) runs = runs.slice(0, filters.limit)
  return runs
}

export function getHeartbeatRunsByAgent(agentId: string): HeartbeatRun[] {
  return getHeartbeatRuns({ agentId })
}

export function createHeartbeatRun(data: Omit<HeartbeatRun, 'id' | 'createdAt'>): HeartbeatRun {
  const run: HeartbeatRun = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }
  db.heartbeatRuns.push(run)
  // Cap at 1000 entries
  if (db.heartbeatRuns.length > 1000) {
    db.heartbeatRuns = db.heartbeatRuns
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 1000)
  }
  saveDatabase()
  return run
}

export function updateHeartbeatRun(id: string, updates: Partial<HeartbeatRun>): HeartbeatRun | null {
  const run = db.heartbeatRuns.find(r => r.id === id)
  if (!run) return null
  Object.assign(run, updates)
  saveDatabase()
  return run
}

// Cost Events

export function getCostEvents(filters?: { agentId?: string; limit?: number }): CostEvent[] {
  let events = db.costEvents || []
  if (filters?.agentId) events = events.filter(e => e.agentId === filters.agentId)
  events = events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  if (filters?.limit) events = events.slice(0, filters.limit)
  return events
}

export function createCostEvent(data: Omit<CostEvent, 'id'>): CostEvent {
  const event: CostEvent = {
    ...data,
    id: generateId(),
  }
  db.costEvents.push(event)
  // Cap at 2000 entries
  if (db.costEvents.length > 2000) {
    db.costEvents = db.costEvents
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 2000)
  }
  saveDatabase()
  return event
}

export function getAgentCostSummary(agentId: string): { totalCents: number; monthCents: number; eventCount: number } {
  const events = (db.costEvents || []).filter(e => e.agentId === agentId)
  const totalCents = events.reduce((sum, e) => sum + e.costCents, 0)
  const firstOfMonth = new Date().toISOString().slice(0, 8) + '01'
  const monthEvents = events.filter(e => e.timestamp >= firstOfMonth)
  const monthCents = monthEvents.reduce((sum, e) => sum + e.costCents, 0)
  return { totalCents, monthCents, eventCount: events.length }
}

// Agent Events

export function appendAgentEvent(data: Omit<AgentEvent, 'id' | 'timestamp'>): AgentEvent {
  const event: AgentEvent = {
    ...data,
    id: generateId(),
    timestamp: new Date().toISOString(),
  }
  db.agentEvents.push(event)
  // Cap at 5000 entries (evict oldest)
  if (db.agentEvents.length > 5000) {
    db.agentEvents = db.agentEvents
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 5000)
  }
  saveDatabase()
  return event
}

export function getAgentEvents(filters?: { agentId?: string; type?: AgentEvent['type']; limit?: number }): AgentEvent[] {
  let events = db.agentEvents || []
  if (filters?.agentId) events = events.filter(e => e.agentId === filters.agentId)
  if (filters?.type) events = events.filter(e => e.type === filters.type)
  events = events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  if (filters?.limit) events = events.slice(0, filters.limit)
  return events
}

// Command Center History
export function addCCHistoryEntry(entry: CCHistoryEntry): CCHistoryEntry {
  db.commandCenterHistory.push(entry)
  saveDatabase()
  return entry
}

export function updateCCHistoryEntry(id: string, updates: Partial<CCHistoryEntry>): CCHistoryEntry | null {
  const entry = db.commandCenterHistory.find(e => e.id === id)
  if (!entry) return null
  Object.assign(entry, updates)
  saveDatabase()
  return entry
}

export function getCCHistory(filter?: string, limit = 100): CCHistoryEntry[] {
  let entries = db.commandCenterHistory
  if (filter) entries = entries.filter(e => e.projectPath === filter)
  return entries.sort((a, b) => (b.completedAt || b.startedAt) - (a.completedAt || a.startedAt)).slice(0, limit)
}

export function cleanupStaleCCHistory(): number {
  let cleaned = 0
  for (const entry of db.commandCenterHistory) {
    if (entry.status === 'running') {
      entry.status = 'crashed'
      entry.summary = entry.summary === 'Running...' ? 'Lost (app closed)' : entry.summary
      entry.completedAt = Date.now()
      cleaned++
    }
  }

  // Deduplicate crashed entries — keep only the most recent per sessionId
  const crashedBySession = new Map<string, typeof db.commandCenterHistory[0]>()
  const toRemove: string[] = []
  for (const entry of db.commandCenterHistory) {
    if (entry.status !== 'crashed' || !entry.sessionId) continue
    const existing = crashedBySession.get(entry.sessionId)
    if (existing) {
      // Keep the newer one, mark the older for removal
      if (entry.completedAt > existing.completedAt) {
        toRemove.push(existing.id)
        crashedBySession.set(entry.sessionId, entry)
      } else {
        toRemove.push(entry.id)
      }
    } else {
      crashedBySession.set(entry.sessionId, entry)
    }
  }
  if (toRemove.length > 0) {
    db.commandCenterHistory = db.commandCenterHistory.filter(e => !toRemove.includes(e.id))
    cleaned += toRemove.length
  }

  if (cleaned > 0) saveDatabase()
  return cleaned
}

// Known Projects
export function getKnownProjects(): KnownProject[] {
  return db.knownProjects.sort((a, b) => b.lastUsed - a.lastUsed)
}

export function upsertKnownProject(projectPath: string): KnownProject {
  const name = path.basename(projectPath)
  const existing = db.knownProjects.find(p => p.path === projectPath)
  if (existing) {
    existing.lastUsed = Date.now()
    existing.name = name
  } else {
    db.knownProjects.push({ path: projectPath, name, lastUsed: Date.now() })
  }
  saveDatabase()
  return db.knownProjects.find(p => p.path === projectPath)!
}

// Decode Claude's project directory encoding (e.g. "C--Users-chris-mega-agenda" → "C:\Users\chris\mega-agenda")
// The encoding uses -- for :\ (drive) and - for both \ (separator) and literal hyphens.
// We resolve the ambiguity by greedily checking which segments exist on disk.
function decodeProjectDir(dirName: string): string | null {
  const dashDash = dirName.indexOf('--')
  if (dashDash === -1) return null

  const drive = dirName.slice(0, dashDash) + ':' + path.sep
  const rest = dirName.slice(dashDash + 2)
  if (!rest) return drive

  const parts = rest.split('-')
  let currentPath = drive
  let i = 0

  while (i < parts.length) {
    let segment = parts[i]
    let found = false
    for (let j = i; j < parts.length; j++) {
      if (j > i) segment += '-' + parts[j]
      const candidate = path.join(currentPath, segment)
      if (j === parts.length - 1) {
        // Last possible grouping — accept it
        currentPath = candidate
        i = j + 1
        found = true
        break
      }
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        currentPath = candidate
        i = j + 1
        found = true
        break
      }
    }
    if (!found) break
  }

  return currentPath
}

export function discoverProjects(): KnownProject[] {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''

  // Source 1: ~/.claude/projects/ (Claude Code CLI history)
  const claudeProjectsDir = path.join(homeDir, '.claude', 'projects')
  if (fs.existsSync(claudeProjectsDir)) {
    try {
      const dirs = fs.readdirSync(claudeProjectsDir)
      for (const dir of dirs) {
        const projectDir = path.join(claudeProjectsDir, dir)
        if (!fs.statSync(projectDir).isDirectory()) continue
        const projectPath = decodeProjectDir(dir)
        if (!projectPath) continue
        if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) continue
        if (!db.knownProjects.find(p => p.path === projectPath)) {
          db.knownProjects.push({ path: projectPath, name: path.basename(projectPath), lastUsed: 0 })
        }
      }
    } catch {}
  }

  // Source 2: Git repos in home directory
  if (homeDir && fs.existsSync(homeDir)) {
    try {
      const entries = fs.readdirSync(homeDir)
      for (const entry of entries) {
        if (entry.startsWith('.')) continue
        const fullPath = path.join(homeDir, entry)
        const gitDir = path.join(fullPath, '.git')
        if (fs.existsSync(gitDir) && !db.knownProjects.find(p => p.path === fullPath)) {
          db.knownProjects.push({ path: fullPath, name: entry, lastUsed: 0 })
        }
      }
    } catch {}
  }

  saveDatabase()
  return db.knownProjects
}

// Dual-Agent Collab History
export function addCollabHistoryEntry(session: CollabHistoryEntry): CollabHistoryEntry {
  db.collabHistory.push(session)
  saveDatabase()
  return session
}

export function getCollabHistory(limit = 50): CollabHistoryEntry[] {
  return db.collabHistory
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit)
}

export function getCollabHistoryEntry(id: string): CollabHistoryEntry | undefined {
  return db.collabHistory.find(e => e.id === id)
}
