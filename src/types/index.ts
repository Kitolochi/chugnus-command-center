// === LLM Settings ===

export type LLMProvider = 'claude' | 'gemini' | 'groq' | 'openrouter' | 'chatgpt' | 'claudeProxy'

export interface LLMSettings {
  provider: LLMProvider
  geminiApiKey: string
  groqApiKey: string
  openrouterApiKey: string
  primaryModel: string
  fastModel: string
}

// === CLI Session Types ===

export interface CLISession {
  sessionId: string
  firstPrompt: string
  messageCount: number
  created: string
  modified: string
  project: string
}

export interface CLISessionMessage {
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  model?: string
  uuid?: string
}

export interface GitHubRepoResult {
  name: string
  fullName: string
  description: string
  url: string
  localPath: string | null
  language: string
  updatedAt: string
}

// === Usage Coach Types ===

export interface CoachTip {
  id: string
  category: 'workflow' | 'prompt' | 'strategic'
  severity: 'info' | 'suggestion' | 'warning'
  title: string
  body: string
  reference: string
  sessionId: string
  project: string
  timestamp: string
  dismissed: boolean
  saved: boolean
}

export interface CoachDbState {
  dayAccumulator: string
  lastResetDate: string
  enabled: boolean
  globalTipsEmitted: string[]
  sessions: Record<
    string,
    {
      byteOffset: number
      tipsEmitted: string[]
    }
  >
}

// === Memory Types ===

export interface Memory {
  id: string
  title: string
  content: string
  topics: string[]
  sourceType: 'chat' | 'cli_session' | 'journal' | 'task' | 'ai_task' | 'manual' | 'coach'
  sourceId: string | null
  sourcePreview: string
  importance: 1 | 2 | 3
  createdAt: string
  updatedAt: string
  isPinned: boolean
  isArchived: boolean
  relatedMemoryIds: string[]
}

export interface MemoryTopic {
  name: string
  color: string
  memoryCount: number
}

export interface MemorySettings {
  autoGenerate: boolean
  maxMemoriesInContext: number
  tokenBudget: number
}

export interface MemoryHealth {
  totalMemories: number
  totalTokens: number
  tokenBudget: number
  budgetUsagePercent: number
  status: 'healthy' | 'warning' | 'critical'
  staleMemoryCount: number
  recommendation: string
}

// === Context Files ===

export interface ContextFile {
  name: string // e.g. "learnings.md" or "data.json"
  path: string // full path
  content: string // file content (empty string for binary)
  modifiedAt: string // ISO timestamp
  folder: string // relative folder path from root, e.g. "" or "research/ai"
  isDirectory: boolean // true if this entry is a folder
  size: number // file size in bytes
}

// === RAG / Embeddings ===

export interface EmbeddingStatus {
  ready: boolean
  loading: boolean
  error: string | null
  progress: number
}

export interface ReorgPlanItem {
  action: 'move' | 'merge' | 'delete'
  source: string
  destination?: string
  reason: string
}

export interface ReorgPlan {
  items: ReorgPlanItem[]
  summary: string
  backupPath?: string
}

// === Knowledge Pack ===

export interface CompressionStats {
  inputTokens: number
  outputTokens: number
  ratio: number
  chunksProcessed: number
  duplicatesRemoved: number
  clustersFound: number
}

export interface DomainSummary {
  domain: string
  label: string
  summary: string
  facts: string[]
  embedding?: number[]
}

export interface CompressedKnowledge {
  overview: string
  domains: DomainSummary[]
  lastCompressed: string
  fileHashSnapshot: Record<string, string>
  stats: CompressionStats
}

export interface KnowledgeCluster {
  label: string
  summary: string
  facts: string[]
  memoryCount: number
}

export interface KnowledgePack {
  id: string
  createdAt: string
  overview: string
  clusters: KnowledgeCluster[]
  stats: {
    totalMemories: number
    totalContextFiles: number
    totalChunks: number
    totalFacts: number
    compressionRatio: number
    durationMs: number
  }
}

export interface CompressionProgress {
  phase: 'embedding' | 'dedup' | 'clustering' | 'summarizing' | 'extracting' | 'overview' | 'done'
  percent: number
  detail: string
}

export interface CompressionAudit {
  coverageScore: number
  totalOriginalItems: number
  coveredItems: number
  uncoveredItems: { text: string; source: string; bestMatchScore: number }[]
  clusterCoverage: { label: string; itemCount: number; factCount: number; avgCoverage: number }[]
  duplicatesRemoved: number
}

// === Lab Types ===

export interface SingleFileTestResult {
  fileName: string
  originalSize: number
  originalText: string
  chunks: number
  clusters: KnowledgeCluster[]
  totalFacts: number
  overview: string
  durationMs: number
}

export interface ContextFileInfo {
  name: string
  size: number
  isStub: boolean
  authority: number
}

export interface FolderCompressionResult {
  folder: string
  fileCount: number
  filesUsed: { name: string; authority: number; chunksContributed: number }[]
  clusters: KnowledgeCluster[]
  overview: string
  totalFacts: number
  dedupRemoved: number
  conflictsResolved: boolean
  durationMs: number
}

// === Agent Orchestration Types ===

export type LifecycleStage = 'research' | 'development' | 'review' | 'committed' | 'pushed' | 'live'

export type AgentTaskType = 'research' | 'code' | 'writing' | 'planning' | 'communication'

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
  stage?: LifecycleStage
  targetStage?: LifecycleStage
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
  type:
    | 'launch'
    | 'complete'
    | 'fail'
    | 'retry'
    | 'requeue'
    | 'budget_alert'
    | 'escalation'
    | 'cooldown'
    | 'pause'
    | 'resume'
    | 'auto_relaunch'
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

// === AgentsView Analytics Types ===

export interface AVStats {
  session_count: number
  message_count: number
  project_count: number
  machine_count: number
  earliest_session: string
}

export interface AVSummary {
  total_sessions: number
  total_messages: number
  active_projects: number
  active_days: number
  avg_messages: number
  median_messages: number
  p90_messages: number
  most_active_project: string
  concentration: number
  agents: Record<string, { sessions: number; messages: number }>
}

export interface AVToolCategory {
  category: string
  count: number
  pct: number
}

export interface AVTools {
  total_calls: number
  by_category: AVToolCategory[]
  by_agent: { agent: string; total: number; categories: AVToolCategory[] }[]
  trend: { date: string; by_category: Record<string, number> }[]
}

export interface AVHeatmapEntry {
  date: string
  value: number
  level: number
}

export interface AVHeatmap {
  metric: string
  entries: AVHeatmapEntry[]
}

export interface AVProject {
  name: string
  sessions: number
  messages: number
  first_session: string
  last_session: string
  avg_messages: number
  median_messages: number
  agents: Record<string, number>
  daily_trend: number
}

export interface AVProjects {
  projects: AVProject[]
}

export interface AVSessionDistribution {
  label: string
  count: number
}

export interface AVSessions {
  count: number
  length_distribution: AVSessionDistribution[]
  duration_distribution: AVSessionDistribution[]
  autonomy_distribution: AVSessionDistribution[]
}

export interface AVTopSession {
  id: string
  project: string
  first_message: string
  message_count: number
  duration_min: number
}

export interface AVTopSessions {
  metric: string
  sessions: AVTopSession[]
}

export interface AVSessionListItem {
  id: string
  project: string
  machine: string
  agent: string
  first_message: string
  started_at: string
  ended_at: string
  message_count: number
  user_message_count: number
  parent_session_id: string | null
  relationship_type: string | null
  created_at: string
}

export interface AVSessionList {
  sessions: AVSessionListItem[]
  next_cursor: string | null
  total: number
}

export interface AVSessionDetail {
  id: string
  project: string
  machine: string
  agent: string
  first_message: string
  started_at: string
  ended_at: string
  message_count: number
  user_message_count: number
  parent_session_id: string | null
  relationship_type: string | null
  created_at: string
}

export interface AVMessage {
  id: number
  session_id: string
  ordinal: number
  role: string
  content: string
}

export interface AVSessionMessages {
  count: number
  messages: AVMessage[]
}

export interface AVSearchResult {
  session_id: string
  project: string
  ordinal: number
  role: string
  timestamp: string
  snippet: string
  rank: number
}

export interface AVSearchResults {
  query: string
  results: AVSearchResult[]
}

export interface AVActivitySeries {
  date: string
  sessions: number
  messages: number
  user_messages: number
  assistant_messages: number
  tool_calls: number
  thinking_messages: number
  by_agent: Record<string, number>
}

export interface AVActivity {
  granularity: string
  series: AVActivitySeries[]
}

export interface AVHourOfWeekCell {
  day_of_week: number
  hour: number
  messages: number
}

export interface AVHourOfWeek {
  cells: AVHourOfWeekCell[]
}

// === File Attachment Types ===

export interface FileAttachment {
  type: 'text' | 'image' | 'video' | 'binary'
  name: string
  mimeType: string
  sizeKb: number
  textContent?: string
  base64?: string
}

// === Dual-Agent Collab Types ===

export type CollabAgent = 'claude' | 'gpt'

export interface CollabTurn {
  id: string
  agent: CollabAgent
  content: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  durationMs: number
  timestamp: number
}

export interface CollabMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CollabSession {
  id: string
  task: string
  status: 'running' | 'awaiting_input' | 'completed' | 'killed' | 'errored'
  turns: CollabTurn[]
  conversationHistory: CollabMessage[]
  totalCostUsd: number
  roundCount: number
  inputQuestion?: string
  summary?: string
  errorMessage?: string
  parentSessionId?: string
  startedAt: number
  updatedAt: number
  completedAt?: number
}

// === ElectronAPI Interface ===

export interface ElectronAPI {
  // LLM Settings
  getLLMSettings: () => Promise<LLMSettings>
  saveLLMSettings: (settings: Partial<LLMSettings>) => Promise<LLMSettings>
  verifyLLMKey: (provider: string, key: string) => Promise<{ valid: boolean; error?: string }>
  getProviderModels: () => Promise<
    Record<string, { primary: { id: string; name: string }[]; fast: { id: string; name: string }[] }>
  >
  getProviderChatModels: () => Promise<Record<string, { id: string; name: string }[]>>

  // Claude API
  getClaudeApiKey: () => Promise<string>
  saveClaudeApiKey: (key: string) => Promise<boolean>
  verifyClaudeKey: (key: string) => Promise<{ valid: boolean; error?: string }>

  // CLI logs
  getCliSessions: () => Promise<CLISession[]>
  getCliSessionMessages: (
    sessionId: string,
    offset?: number,
    limit?: number
  ) => Promise<{ messages: CLISessionMessage[]; hasMore: boolean }>
  searchCliSessions: (
    query: string
  ) => Promise<{ sessionId: string; firstPrompt: string; matches: string[]; project: string }[]>
  searchGitHubRepos: (query: string) => Promise<GitHubRepoResult[]>

  // Launch external terminal
  launchExternalTerminal: (prompt: string, cwd?: string) => Promise<void>

  // Smart Query
  smartQuery: (query: string) => Promise<{ queryId: string }>
  onSmartQueryChunk: (callback: (data: { queryId: string; text: string }) => void) => () => void
  onSmartQueryEnd: (callback: (data: { queryId: string }) => void) => () => void
  onSmartQueryError: (callback: (data: { queryId: string; error: string }) => void) => () => void

  // RAG / Embeddings
  getEmbeddingStatus: () => Promise<EmbeddingStatus>
  rebuildVectorIndex: () => Promise<{ added: number; removed: number; total: number }>
  generateReorgPlan: () => Promise<ReorgPlan>
  executeReorgPlan: (plan: ReorgPlan) => Promise<{ success: boolean; backupPath: string }>
  onEmbeddingProgress: (callback: (progress: number) => void) => () => void
  onIndexProgress: (callback: (info: { phase: string; current: number; total: number }) => void) => () => void

  // Context Files
  getContextFiles: () => Promise<ContextFile[]>
  saveContextFile: (name: string, content: string, folder?: string) => Promise<ContextFile>
  deleteContextFile: (name: string) => Promise<boolean>
  createContextFolder: (relativePath: string) => Promise<boolean>
  deleteContextFolder: (relativePath: string) => Promise<boolean>
  uploadContextFiles: (targetFolder: string) => Promise<ContextFile[]>
  scaffoldDomainFolders: () => Promise<boolean>

  // Memory
  getMemories: () => Promise<Memory[]>
  createMemory: (memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Memory>
  updateMemory: (id: string, updates: Partial<Memory>) => Promise<Memory | null>
  deleteMemory: (id: string) => Promise<void>
  archiveMemory: (id: string) => Promise<Memory | null>
  pinMemory: (id: string) => Promise<Memory | null>
  getMemoryTopics: () => Promise<MemoryTopic[]>
  updateMemoryTopics: (topics: MemoryTopic[]) => Promise<MemoryTopic[]>
  getMemorySettings: () => Promise<MemorySettings>
  saveMemorySettings: (settings: Partial<MemorySettings>) => Promise<MemorySettings>
  extractMemoriesFromChat: (conversationId: string) => Promise<Memory[]>
  extractMemoriesFromCli: (sessionId: string) => Promise<Memory[]>
  extractMemoriesFromJournal: (date: string) => Promise<Memory[]>
  batchExtractMemories: () => Promise<Memory[]>

  // Knowledge Pack
  getKnowledgePacks: () => Promise<KnowledgePack[]>
  compressKnowledge: () => Promise<KnowledgePack>
  auditCompression: () => Promise<CompressionAudit>
  getMemoryHealth: () => Promise<MemoryHealth>
  autoPruneMemories: () => Promise<number>
  startHealthMonitor: (intervalMs: number) => Promise<void>
  stopHealthMonitor: () => Promise<void>
  onCompressionProgress: (callback: (progress: CompressionProgress) => void) => () => void
  onMemoryHealthUpdate: (callback: (health: MemoryHealth) => void) => () => void

  // Lab tools
  compressSingleFile: (relativePath: string) => Promise<SingleFileTestResult>
  compressFolder: (folder: string) => Promise<FolderCompressionResult>
  testEmbeddingSimilarity: (textA: string, textB: string) => Promise<{ similarity: number; embeddingDim: number }>
  listContextFiles: () => Promise<ContextFileInfo[]>

  // ChatGPT OAuth
  chatgptOAuthStart: () => Promise<{ connected: boolean; profile: { sub: string; name: string; email: string } }>
  chatgptOAuthDisconnect: () => Promise<void>
  chatgptOAuthStatus: () => Promise<{
    connected: boolean
    profile?: { sub: string; name: string; email: string }
    expiresAt?: string
  }>
  chatgptOAuthRefresh: () => Promise<{ refreshed: boolean }>

  // Agent Orchestration
  getAgents: () => Promise<Agent[]>
  getAgent: (id: string) => Promise<Agent | null>
  createAgent: (
    data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'spentMonthlyCents' | 'budgetResetDate' | 'status'>
  ) => Promise<Agent>
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<Agent | null>
  deleteAgent: (id: string) => Promise<void>
  setAgentStatus: (id: string, status: Agent['status'], lastError?: string) => Promise<Agent | null>
  getAgentIssues: (filters?: { agentId?: string; status?: AgentIssue['status'] }) => Promise<AgentIssue[]>
  getAgentIssue: (id: string) => Promise<AgentIssue | null>
  createAgentIssue: (data: Omit<AgentIssue, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AgentIssue>
  updateAgentIssue: (id: string, updates: Partial<AgentIssue>) => Promise<AgentIssue | null>
  deleteAgentIssue: (id: string) => Promise<void>
  getHeartbeatRuns: (filters?: { agentId?: string; issueId?: string; limit?: number }) => Promise<HeartbeatRun[]>
  runAgentHeartbeat: (agentId: string, issueId?: string) => Promise<HeartbeatRun | null>
  completeHeartbeatRun: (runId: string, updates: Partial<HeartbeatRun>) => Promise<HeartbeatRun | null>
  getCostEvents: (filters?: { agentId?: string; limit?: number }) => Promise<CostEvent[]>
  getAgentCostSummary: (agentId: string) => Promise<{ totalCents: number; monthCents: number; eventCount: number }>
  pollAgentSessions: () => Promise<HeartbeatRun[]>
  getAgentEvents: (filters?: { agentId?: string; type?: AgentEvent['type']; limit?: number }) => Promise<AgentEvent[]>
  onAgentsUpdated: (callback: () => void) => () => void

  // AgentsView Analytics
  avPing: () => Promise<boolean>
  avGetStats: () => Promise<AVStats>
  avGetSummary: (days?: number) => Promise<AVSummary>
  avGetTools: (days?: number) => Promise<AVTools>
  avGetHeatmap: () => Promise<AVHeatmap>
  avGetProjects: () => Promise<AVProjects>
  avGetSessions: () => Promise<AVSessions>
  avGetTopSessions: () => Promise<AVTopSessions>
  avGetSessionList: (opts?: { limit?: number; project?: string; search?: string }) => Promise<AVSessionList>
  avGetSessionDetail: (id: string) => Promise<AVSessionDetail>
  avGetSessionMessages: (id: string, limit?: number) => Promise<AVSessionMessages>
  avSearch: (q: string, limit?: number) => Promise<AVSearchResults>
  avGetActivity: (days?: number) => Promise<AVActivity>
  avGetHourOfWeek: () => Promise<AVHourOfWeek>
  avGetSessionChildren: (id: string) => Promise<AVSessionListItem[]>
  avRefresh: () => Promise<boolean>

  // Command Center
  ccLaunch: (opts: {
    projectPath: string
    prompt: string
    model?: string
    effort?: string
    maxBudget?: number
    resumeSessionId?: string
  }) => Promise<any>
  ccRespond: (opts: { processId: string; response: string }) => Promise<void>
  ccDismiss: (opts: { processId: string }) => Promise<any>
  ccPark: (opts: { processId: string }) => Promise<any>
  ccKill: (opts: { processId: string }) => Promise<void>
  ccGetQueue: () => Promise<any[]>
  ccGetLog: (opts: { processId: string }) => Promise<any[]>
  ccGetHistory: (opts?: { filter?: string; limit?: number }) => Promise<any[]>
  ccGetCrashedIds: () => Promise<string[]>
  ccGetDailyPrompts: () => Promise<{ date: string; count: number }>
  ccGetProjects: () => Promise<any[]>
  ccGetProjectDescription: (opts: { projectPath: string }) => Promise<string>
  ccBrowseProject: () => Promise<{ path: string; name: string } | null>
  ccCreateProject: (opts: { name: string }) => Promise<{ path: string; name: string } | null>
  ccExecShell: (opts: { command: string; cwd: string }) => Promise<{ stdout: string; stderr: string; code: number }>
  ccGetSettings: () => Promise<{ defaultEffort: string; defaultModel: string; autoInferModel: boolean }>
  ccSaveSettings: (
    updates: Partial<{ defaultEffort: string; defaultModel: string; autoInferModel: boolean }>
  ) => Promise<any>
  onCCQueueUpdate: (callback: (queue: any[]) => void) => () => void

  // Codex Chat (GPT 5.4)
  codexSend: (opts: {
    messages: { role: string; content: string }[]
    projectPath?: string
  }) => Promise<{ content: string; tokensIn: number; tokensOut: number }>
  codexReadTree: (opts: { projectPath: string }) => Promise<string>
  codexReadFile: (opts: { filePath: string }) => Promise<string>
  codexReadFileForChat: (opts: { filePath: string }) => Promise<FileAttachment>

  // Dual-Agent Collab
  collabStart: (opts: { task: string; maxRounds?: number }) => Promise<{ sessionId: string }>
  collabResume: (opts: { sessionId: string; maxRounds?: number }) => Promise<{ sessionId: string }>
  collabRespond: (opts: { sessionId: string; response: string }) => Promise<void>
  collabKill: (opts: { sessionId: string }) => Promise<void>
  collabGetSession: () => Promise<CollabSession | null>
  collabGetHistory: (opts?: { limit?: number }) => Promise<CollabSession[]>
  onCollabUpdate: (callback: (session: CollabSession) => void) => () => void

  // Notifications
  showNotification: (title: string, body: string) => Promise<void>

  // Open URL in browser
  openExternal: (url: string) => Promise<void>

  // Clipboard
  readClipboard: () => string
  writeClipboard: (text: string) => void

  // Window controls
  closeWindow: () => void
  minimizeWindow: () => void

  // Usage Coach
  coachToggle: (enabled: boolean) => Promise<void>
  coachSaveTip: (tip: CoachTip) => Promise<void>
  coachClearDay: () => Promise<void>
  onCoachTips: (callback: (tips: CoachTip[]) => void) => () => void
  onCoachStatus: (callback: (data: { status: string; sessionCount: number }) => void) => () => void
  onCoachDaySummary: (callback: (summary: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
