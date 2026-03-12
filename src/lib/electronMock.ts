/**
 * Mock electronAPI for browser-based development/testing.
 * When the app runs outside Electron (e.g. localhost in a browser),
 * this provides stub responses so the UI renders without crashing.
 */

const noop = async () => {}
const emptyArray = async () => []
const noopUnsub = () => () => {}

const MOCK_CATEGORIES = [
  { id: 1, name: 'Work', color: '#8b5cf6', icon: '💼', sort_order: 0 },
  { id: 2, name: 'Personal', color: '#3b82f6', icon: '🏠', sort_order: 1 },
]

const MOCK_STATS = {
  currentStreak: 1,
  bestStreak: 5,
  lastStreakDate: new Date().toISOString().split('T')[0],
  tasksCompletedThisWeek: 3,
  weekStartDate: new Date().toISOString().split('T')[0],
}

export function installElectronMock() {
  if (window.electronAPI) return // Already in Electron, skip

  console.log('[DEV] Running in browser mode with mock electronAPI')

  window.electronAPI = {
    // Tasks
    getCategories: async () => MOCK_CATEGORIES,
    addCategory: async (name: string, color: string, icon: string) => ({ id: Date.now(), name, color, icon, sort_order: 0 }),
    deleteCategory: noop as any,
    getTasks: emptyArray as any,
    addTask: async (t: any) => ({ ...t, id: Date.now(), created_at: new Date().toISOString() }),
    updateTask: async (_id: number, u: any) => u,
    deleteTask: noop as any,
    toggleTask: async (id: number) => ({ id, completed: 1 }),

    // Notes
    getDailyNote: async () => null,
    saveDailyNote: async (date: string, content: string) => ({ date, content, updated_at: new Date().toISOString() }),
    getRecentNotes: emptyArray as any,

    // Stats
    getStats: async () => MOCK_STATS,

    // Twitter
    getTwitterSettings: async () => ({ bearerToken: '', username: '', userId: '', listIds: [], apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' }),
    saveTwitterSettings: async (s: any) => s,
    verifyTwitterToken: async () => ({ valid: false, error: 'Mock mode' }),
    twitterGetUser: async () => null,
    twitterGetLists: emptyArray as any,
    twitterFetchFeed: emptyArray as any,

    // RSS
    getRSSFeeds: emptyArray as any,
    addRSSFeed: emptyArray as any,
    removeRSSFeed: emptyArray as any,
    fetchRSSFeeds: emptyArray as any,

    // Claude/LLM
    getClaudeApiKey: async () => '',
    saveClaudeApiKey: async () => true,
    verifyClaudeKey: async () => ({ valid: false }),
    summarizeFeed: async () => 'Mock summary',
    parseVoiceCommand: async () => ({ action: 'unknown' as const }),
    getLLMSettings: async () => ({ provider: 'claude' as const, geminiApiKey: '', groqApiKey: '', openrouterApiKey: '', primaryModel: '', fastModel: '' }),
    saveLLMSettings: async (s: any) => s,
    verifyLLMKey: async () => ({ valid: false }),
    getProviderModels: async () => ({}),
    getProviderChatModels: async () => ({}),

    // Research
    researchRoadmapGoal: async () => ({ researched: 0, total: 0 }),
    onResearchProgress: noopUnsub as any,
    cancelResearch: noop as any,
    researchRoadmapTopic: async () => ({ report: '', generatedAt: '' }),
    generateActionPlan: async () => ({ report: '', generatedAt: '' }),
    generateTopics: async () => ({ added: { questions: 0, guidance: 0 }, total: { questions: 0, guidance: 0 } }),
    removeTopicReport: async () => ({ removed: 1, remaining: 0 }),
    purgeStubReports: async () => ({ removed: 0, remaining: 0 }),
    categorizeGoalTopics: async () => [],

    // Tweet posting
    postTweet: async () => ({ success: false, error: 'Mock mode' }),
    verifyTwitterOAuth: async () => ({ valid: false }),

    // Activity
    getActivityLog: emptyArray as any,

    // Pomodoro
    getPomodoroState: async () => ({ isRunning: false, currentSession: null, sessionsCompleted: 0, totalSessionsToday: 0, todayDate: '' }),
    startPomodoro: async () => ({ isRunning: false, currentSession: null, sessionsCompleted: 0, totalSessionsToday: 0, todayDate: '' }),
    completePomodoro: async () => ({ isRunning: false, currentSession: null, sessionsCompleted: 0, totalSessionsToday: 0, todayDate: '' }),
    startBreak: async () => ({ isRunning: false, currentSession: null, sessionsCompleted: 0, totalSessionsToday: 0, todayDate: '' }),
    stopPomodoro: async () => ({ isRunning: false, currentSession: null, sessionsCompleted: 0, totalSessionsToday: 0, todayDate: '' }),

    // Morning/Weekly
    getMorningBriefing: async () => null,
    generateMorningBriefing: async () => ({ date: '', content: '', isAiEnhanced: false, dismissed: false, generatedAt: '' }),
    dismissMorningBriefing: noop as any,
    getWeeklyReview: async () => null,
    getAllWeeklyReviews: emptyArray as any,
    generateWeeklyReview: async () => ({ weekStartDate: '', content: '', generatedAt: '', tasksCompletedCount: 0, categoriesWorked: [], streakAtGeneration: 0 }),
    checkWeeklyReviewNeeded: async () => ({ needed: false, weekStart: '' }),

    // Notifications
    showNotification: noop as any,

    // Terminal
    createTerminal: noop as any,
    writeTerminal: noop as any,
    resizeTerminal: noop as any,
    killTerminal: noop as any,
    onTerminalData: noopUnsub as any,

    // CLI
    getUseCliMode: async () => false,
    setUseCliMode: async () => false,
    checkCliAvailable: async () => ({ available: false, path: null }),

    // Clipboard
    readClipboard: () => '',
    writeClipboard: () => {},

    // Utilities
    openExternal: noop as any,

    // Window
    closeWindow: () => {},
    minimizeWindow: () => {},
    onOpenAddModal: noopUnsub as any,
    onTasksUpdated: noopUnsub as any,

    // Chat
    getChatConversations: emptyArray as any,
    getChatConversation: async () => null,
    createChatConversation: async (title: string) => ({ id: Date.now().toString(), title, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    addChatMessage: async () => null as any,
    deleteChatConversation: noop as any,
    renameChatConversation: async () => null as any,
    getChatSettings: async () => ({ model: '', systemPromptMode: 'default' as const, maxTokens: 4096 }),
    saveChatSettings: async (s: any) => s,

    // Chat streaming
    chatSendMessage: noop as any,
    chatAbort: noop as any,
    getMemoryCountForChat: async () => 0,
    onChatStreamChunk: noopUnsub as any,
    onChatStreamEnd: noopUnsub as any,
    onChatStreamError: noopUnsub as any,

    // CLI logs
    getCliSessions: emptyArray as any,
    getCliSessionMessages: async () => ({ messages: [], hasMore: false }),
    searchCliSessions: emptyArray as any,
    searchGitHubRepos: emptyArray as any,

    // Tweet drafts
    getTweetDrafts: emptyArray as any,
    getTweetDraft: async () => null,
    createTweetDraft: async () => ({ id: '', text: '', segments: [], isThread: false, status: 'draft' as const, aiHistory: [], createdAt: '', updatedAt: '', threadTweetIds: [] }),
    updateTweetDraft: async () => null,
    addTweetAIMessage: async () => null,
    deleteTweetDraft: noop as any,

    // Tweet AI
    tweetBrainstorm: async () => '',
    tweetBrainstormThread: async () => '',
    tweetRefine: async () => '',
    tweetAnalyze: async () => '',

    // Tweet Personas
    getTweetPersonas: emptyArray as any,
    createTweetPersona: async (p: any) => ({ ...p, id: Date.now().toString(), isBuiltIn: false, createdAt: new Date().toISOString() }),
    deleteTweetPersona: noop as any,

    // External terminal
    launchExternalTerminal: noop as any,

    // AI Tasks
    getAITasks: emptyArray as any,
    createAITask: async (t: any) => ({ ...t, id: Date.now().toString(), column: 'backlog', createdAt: '', updatedAt: '' }),
    updateAITask: async () => null,
    deleteAITask: noop as any,
    moveAITask: async () => null,

    // Roadmap
    getRoadmapGoals: emptyArray as any,
    createRoadmapGoal: async (g: any) => ({ ...g, id: Date.now().toString(), createdAt: '', updatedAt: '' }),
    updateRoadmapGoal: async () => null,
    deleteRoadmapGoal: noop as any,

    // Master Plan
    getMasterPlan: async () => null,
    generateMasterPlan: async () => ({ content: '', generatedAt: '', goalIds: [], metadata: { totalGoals: 0, goalsWithResearch: 0 } }),
    clearMasterPlan: noop as any,

    // Master Plan Execution
    generateContextQuestions: emptyArray as any,
    getMasterPlanTasks: emptyArray as any,
    updateMasterPlanTask: async () => null,
    launchDailyPlan: async () => ({ launched: 0, taskIds: [] }),
    pollTaskSessions: emptyArray as any,

    // Goal Action Plan
    extractGoalActionTasks: emptyArray as any,
    launchGoalTasks: async () => ({ launched: 0, taskIds: [] }),
    pollGoalTaskSessions: emptyArray as any,
    getGoalWorkspace: async () => null,
    getGoalDeliverables: emptyArray as any,
    getGoalGitLog: emptyArray as any,
    getGoalRepoInfo: async () => null,
    extractGoalLearnings: async () => ({ memoriesCreated: 0, memories: [] }),

    // Orchestrator
    stopOrchestrator: noop as any,
    isOrchestratorRunning: async () => false,
    onOrchestratorOutput: noopUnsub as any,

    // Smart Query
    smartQuery: async () => ({ queryId: '' }),
    onSmartQueryChunk: noopUnsub as any,
    onSmartQueryEnd: noopUnsub as any,
    onSmartQueryError: noopUnsub as any,

    // Welcome
    isWelcomeDismissed: async () => true,
    dismissWelcome: noop as any,

    // Context Files
    getContextFiles: emptyArray as any,
    saveContextFile: async () => ({} as any),
    deleteContextFile: async () => true,
    createContextFolder: async () => true,
    deleteContextFolder: async () => true,
    uploadContextFiles: emptyArray as any,
    scaffoldDomainFolders: async () => true,

    // Whisper
    transcribeAudio: async () => '',
    transcribeAudioBlob: async () => '',
    getWhisperStatus: async () => ({ ready: false, loading: false, error: null, progress: 0 }),

    // Embeddings
    getEmbeddingStatus: async () => ({ ready: false, loading: false, error: null, progress: 0 }),
    rebuildVectorIndex: async () => ({ added: 0, removed: 0, total: 0 }),
    generateReorgPlan: async () => ({ items: [], summary: '' }),
    executeReorgPlan: async () => ({ success: true, backupPath: '' }),
    onEmbeddingProgress: noopUnsub as any,
    onIndexProgress: noopUnsub as any,

    // Knowledge Pack
    getKnowledgePacks: emptyArray as any,
    compressKnowledge: async () => ({ id: '', createdAt: '', overview: '', clusters: [], stats: { totalMemories: 0, totalContextFiles: 0, totalChunks: 0, totalFacts: 0, compressionRatio: 0, durationMs: 0 } }),
    auditCompression: async () => ({ coverageScore: 0, totalOriginalItems: 0, coveredItems: 0, uncoveredItems: [], clusterCoverage: [], duplicatesRemoved: 0 }),
    getMemoryHealth: async () => ({ totalMemories: 0, totalTokens: 0, tokenBudget: 50000, budgetUsagePercent: 0, status: 'healthy' as const, staleMemoryCount: 0, recommendation: '' }),
    autoPruneMemories: async () => 0,
    startHealthMonitor: noop as any,
    stopHealthMonitor: noop as any,
    onCompressionProgress: noopUnsub as any,
    onMemoryHealthUpdate: noopUnsub as any,

    // Lab tools
    compressSingleFile: async () => ({ fileName: '', originalSize: 0, originalText: '', chunks: 0, clusters: [], totalFacts: 0, overview: '', durationMs: 0 }),
    compressFolder: async () => ({ folder: '', fileCount: 0, filesUsed: [], clusters: [], overview: '', totalFacts: 0, dedupRemoved: 0, conflictsResolved: false, durationMs: 0 }),
    testEmbeddingSimilarity: async () => ({ similarity: 0, embeddingDim: 384 }),
    listContextFiles: async () => [],

    // Memory
    getMemories: emptyArray as any,
    createMemory: async (m: any) => ({ ...m, id: Date.now().toString(), createdAt: '', updatedAt: '' }),
    updateMemory: async () => null,
    deleteMemory: noop as any,
    archiveMemory: async () => null,
    pinMemory: async () => null,
    getMemoryTopics: emptyArray as any,
    updateMemoryTopics: emptyArray as any,
    getMemorySettings: async () => ({ autoGenerate: true, maxMemoriesInContext: 10, tokenBudget: 50000 }),
    saveMemorySettings: async (s: any) => s,
    extractMemoriesFromChat: emptyArray as any,
    extractMemoriesFromCli: emptyArray as any,
    extractMemoriesFromJournal: emptyArray as any,
    batchExtractMemories: emptyArray as any,

    // Network CRM
    getNetworkContacts: emptyArray as any,
    getNetworkContact: async () => null,
    createNetworkContact: async (data: any) => ({ ...data, id: Date.now().toString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    updateNetworkContact: async () => null,
    deleteNetworkContact: noop as any,
    getContactInteractions: emptyArray as any,
    createContactInteraction: async (data: any) => ({ ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }),
    deleteContactInteraction: noop as any,
    getPipelines: emptyArray as any,
    createPipeline: async (data: any) => ({ ...data, id: Date.now().toString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    updatePipeline: async () => null,
    deletePipeline: noop as any,
    getPipelineCards: emptyArray as any,
    createPipelineCard: async (data: any) => ({ ...data, id: Date.now().toString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    updatePipelineCard: async () => null,
    movePipelineCard: async () => null,
    deletePipelineCard: noop as any,

    // Social Connectors
    getSocialConnections: emptyArray as any,
    connectSocialProvider: async () => ({} as any),
    disconnectSocialProvider: noop as any,
    deleteSocialConnection: noop as any,
    syncSocialProvider: async () => ({ newContacts: 0, newInteractions: 0 }),
    getContactMappings: emptyArray as any,
    deleteContactMapping: noop as any,
    telegramSendCode: async () => ({ phoneCodeHash: '' }),
    telegramVerifyCode: async () => ({ session: '', accountId: '', accountName: '' }),
    smsDetectDb: async () => ({ found: false, path: null }),
    getSocialSyncStatus: async () => ({ status: 'disconnected' as const, lastSyncAt: null }),
    twitterSyncContacts: async () => ({ newContacts: 0, newInteractions: 0 }),

    // Bank Sync
    getBankConnections: emptyArray as any,
    connectBank: async () => ({} as any),
    deleteBankConnection: noop as any,
    syncBankConnection: async () => ({ accounts: [], transactions: 0 }),
    syncAllBankConnections: noop as any,
    getBankAccounts: emptyArray as any,
    getBankTransactions: emptyArray as any,
    getCategoryOverrides: async () => ({}),
    setCategoryOverride: async () => ({}),
    removeCategoryOverride: async () => ({}),

    // Outreach Settings
    getOutreachSettings: async () => ({ google_places_api_key: '', apollo_api_key: '', default_lat: '35.2271', default_lng: '-80.8431', default_radius: '25000', resume_link: '', onboarding_completed: 'false' }),
    setOutreachSetting: async () => ({ google_places_api_key: '', apollo_api_key: '', default_lat: '35.2271', default_lng: '-80.8431', default_radius: '25000', resume_link: '', onboarding_completed: 'false' }),
    validateApiKey: async () => ({ valid: false, message: 'Mock mode' }),
    runSeedDiscovery: async () => ({ totalImported: 0, categories: 0 }),
    getOutreachBusinessCount: async () => 0,
    onSeedProgress: noopUnsub as any,

    // Auto-Research
    runAutoResearch: async () => ({ discovered: 0, enriched: 0, contactsFound: 0, socialLinksFound: 0 }),
    onAutoResearchProgress: noopUnsub as any,

    // Outreach
    searchBusinesses: emptyArray as any,
    scrapeBusinesses: emptyArray as any,
    getBusinesses: emptyArray as any,
    getBusiness: async () => null,
    importBusinesses: emptyArray as any,
    updateBusiness: async () => null,
    deleteBusiness: noop as any,
    enrichBusiness: async () => null,
    getBusinessContacts: emptyArray as any,
    createContact: async (data: any) => ({ ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }),
    getOutreachHistory: emptyArray as any,
    createOutreach: async (data: any) => ({ ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }),
    getTemplates: emptyArray as any,
    createTemplate: async (data: any) => ({ ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }),
    updateTemplate: async () => null,
    deleteTemplate: noop as any,
    generateMessage: async () => '',
    getOutreachPipelineStats: emptyArray as any,

    // Content Writer
    getContentDrafts: emptyArray as any,
    getContentDraft: async () => null,
    createContentDraft: async () => ({ id: 'mock', contentType: 'tweet', topic: '', research: '', outline: '', content: '', messages: [], status: 'researching', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    updateContentDraft: async () => null,
    deleteContentDraft: noop as any,
    contentResearch: noop as any,
    contentResearchAbort: noop as any,
    contentGenerate: noop as any,
    contentAbort: noop as any,
    onContentResearchChunk: noopUnsub as any,
    onContentResearchEnd: noopUnsub as any,
    onContentResearchError: noopUnsub as any,
    onContentStreamChunk: noopUnsub as any,
    onContentStreamEnd: noopUnsub as any,
    onContentStreamError: noopUnsub as any,
    onContentScoresReady: noopUnsub as any,
    onContentScoresError: noopUnsub as any,
    getScoreSnapshots: emptyArray as any,
    getTweetPatterns: emptyArray as any,
    extractTweetPatterns: emptyArray as any,
    getSessionInsights: emptyArray as any,
    importSessionTweet: async () => ({} as any),
    onContentAutoRefineStart: noopUnsub as any,
    updateOutreach: async () => null,

    // Calendar
    getCalendarEvents: emptyArray as any,
    getDailyAgenda: async () => ({ tasks: [], events: [] }),
    createCalendarEvent: async (data: any) => ({ ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }),
    updateCalendarEvent: async () => null,
    deleteCalendarEvent: noop as any,
    getCalendarHistory: async () => ({ tasks: [], events: [] }),
    syncGcalEvents: async () => ({ success: false }),
    fireDailyNotification: async () => null,

    // Routines
    getRoutines: emptyArray as any,
    getRoutine: async () => null,
    createRoutine: async (data: any) => ({ ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }),
    updateRoutine: async () => null,
    deleteRoutine: noop as any,
    runRoutine: async () => null,
    getRoutineResults: emptyArray as any,
    getRoutineResultsForDate: emptyArray as any,
    deleteRoutineResult: noop as any,
    onRoutinesUpdated: noopUnsub as any,

    // Agents
    getAgents: emptyArray as any,
    getAgent: async () => null,
    createAgent: async (data: any) => ({ ...data, id: Date.now().toString(), status: 'idle', spentMonthlyCents: 0, budgetResetDate: '', createdAt: '', updatedAt: '' }),
    updateAgent: async () => null,
    deleteAgent: noop as any,
    setAgentStatus: async () => null,
    getAgentIssues: emptyArray as any,
    getAgentIssue: async () => null,
    createAgentIssue: async (data: any) => ({ ...data, id: Date.now().toString(), createdAt: '', updatedAt: '' }),
    updateAgentIssue: async () => null,
    deleteAgentIssue: noop as any,
    getHeartbeatRuns: emptyArray as any,
    runAgentHeartbeat: async () => null,
    completeHeartbeatRun: async () => null,
    getCostEvents: emptyArray as any,
    getAgentCostSummary: async () => ({ totalCents: 0, monthCents: 0, eventCount: 0 }),
    pollAgentSessions: emptyArray as any,
    onAgentsUpdated: noopUnsub as any,

    // Guide Chat
    guideChatSend: noop as any,
    guideChatAbort: noop as any,
    onGuideChatChunk: noopUnsub as any,
    onGuideChatEnd: noopUnsub as any,
    onGuideChatError: noopUnsub as any,

    // Google Workspace
    gwsCheckAuth: async () => ({ installed: false, authenticated: false }),
    gwsSendEmail: async () => ({ success: false }),
    gwsCreateEvent: async () => ({ success: false }),
    gwsExportSheets: async () => ({ success: false }),
    gwsUploadDrive: async () => ({ success: false }),

    // Pomodoro extras
    savePomodoroSession: async () => ({} as any),
    getPomodoroStats: async () => ({ todaySessions: 0, todayMinutes: 0, weekSessions: 0, weekMinutes: 0, streak: 0, mostFocusedTask: null }),

    // AgentsView Analytics
    avPing: async () => false,
    avGetStats: async () => ({ session_count: 0, message_count: 0, project_count: 0, machine_count: 0, earliest_session: '' }),
    avGetSummary: async () => ({ total_sessions: 0, total_messages: 0, active_projects: 0, active_days: 0, avg_messages: 0, median_messages: 0, p90_messages: 0, most_active_project: '', concentration: 0, agents: {} }),
    avGetTools: async () => ({ total_calls: 0, by_category: [], by_agent: [], trend: [] }),
    avGetVelocity: async () => ({ overall: { turn_cycle_sec: { p50: 0, p90: 0 }, first_response_sec: { p50: 0, p90: 0 }, msgs_per_active_min: 0, chars_per_active_min: 0, tool_calls_per_active_min: 0 }, by_agent: [], by_complexity: [] }),
    avGetHeatmap: async () => ({ metric: 'messages', entries: [] }),
    avGetProjects: async () => ({ projects: [] }),
    avGetSessions: async () => ({ count: 0, length_distribution: [], duration_distribution: [], autonomy_distribution: [] }),
    avGetTopSessions: async () => ({ metric: 'messages', sessions: [] }),
    avGetSessionList: async () => ({ sessions: [], next_cursor: null, total: 0 }),
    avGetSessionDetail: async () => ({ id: '', project: '', machine: '', agent: '', first_message: '', started_at: '', ended_at: '', message_count: 0, user_message_count: 0, parent_session_id: null, relationship_type: null, created_at: '' }),
    avGetSessionMessages: async () => ({ count: 0, messages: [] }),
    avGetInsights: async () => ({ insights: [] }),
    avGetSyncStatus: async () => ({ last_sync: '', stats: { total_sessions: 0, synced: 0, skipped: 0, failed: 0 } }),
    avSync: async () => ({ events: [] }),
    avGenerateInsights: async () => ({ events: [] }),
    avSearch: async () => ({ query: '', results: [] }),
    avGetActivity: async () => ({ granularity: 'day', series: [] }),
    avGetHourOfWeek: async () => ({ cells: [] }),
    avGetSessionChildren: async () => [],
    avExportSession: async () => '<html><body>No data</body></html>',

    // AgentsView Process Management
    avProcessStart: async () => false,
    avProcessStop: async () => true,
    avProcessStatus: async () => 'not-installed' as const,
  } as any
}
