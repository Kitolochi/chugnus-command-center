import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Claude API key management
  getClaudeApiKey: () => ipcRenderer.invoke('get-claude-api-key'),
  saveClaudeApiKey: (key: string) => ipcRenderer.invoke('save-claude-api-key', key),
  verifyClaudeKey: (key: string) => ipcRenderer.invoke('verify-claude-key', key),

  // LLM Settings
  getLLMSettings: () => ipcRenderer.invoke('get-llm-settings'),
  saveLLMSettings: (settings: any) => ipcRenderer.invoke('save-llm-settings', settings),
  verifyLLMKey: (provider: string, key: string) => ipcRenderer.invoke('verify-llm-key', provider, key),
  getProviderModels: () => ipcRenderer.invoke('get-provider-models'),
  getProviderChatModels: () => ipcRenderer.invoke('get-provider-chat-models'),

  // CLI logs
  getCliSessions: () => ipcRenderer.invoke('get-cli-sessions'),
  getCliSessionMessages: (sessionId: string, offset?: number, limit?: number) =>
    ipcRenderer.invoke('get-cli-session-messages', sessionId, offset, limit),
  searchCliSessions: (query: string) => ipcRenderer.invoke('search-cli-sessions', query),
  searchGitHubRepos: (query: string) => ipcRenderer.invoke('search-github-repos', query),

  // Launch external terminal
  launchExternalTerminal: (prompt: string, cwd?: string) =>
    ipcRenderer.invoke('launch-external-terminal', prompt, cwd),

  // Smart Query
  smartQuery: (query: string) => ipcRenderer.invoke('smart-query', query),
  onSmartQueryChunk: (callback: (data: { queryId: string; text: string }) => void) => {
    const handler = (_: any, data: { queryId: string; text: string }) => callback(data)
    ipcRenderer.on('smart-query-chunk', handler)
    return () => { ipcRenderer.removeListener('smart-query-chunk', handler) }
  },
  onSmartQueryEnd: (callback: (data: { queryId: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('smart-query-end', handler)
    return () => { ipcRenderer.removeListener('smart-query-end', handler) }
  },
  onSmartQueryError: (callback: (data: { queryId: string; error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('smart-query-error', handler)
    return () => { ipcRenderer.removeListener('smart-query-error', handler) }
  },

  // RAG / Embeddings
  getEmbeddingStatus: () => ipcRenderer.invoke('get-embedding-status'),
  rebuildVectorIndex: () => ipcRenderer.invoke('rebuild-vector-index'),
  generateReorgPlan: () => ipcRenderer.invoke('generate-reorg-plan'),
  executeReorgPlan: (plan: any) => ipcRenderer.invoke('execute-reorg-plan', plan),
  onEmbeddingProgress: (callback: (progress: number) => void) => {
    const handler = (_: any, progress: number) => callback(progress)
    ipcRenderer.on('embedding-progress', handler)
    return () => { ipcRenderer.removeListener('embedding-progress', handler) }
  },
  onIndexProgress: (callback: (info: { phase: string; current: number; total: number }) => void) => {
    const handler = (_: any, info: any) => callback(info)
    ipcRenderer.on('index-progress', handler)
    return () => { ipcRenderer.removeListener('index-progress', handler) }
  },

  // Context Files
  getContextFiles: () => ipcRenderer.invoke('get-context-files'),
  saveContextFile: (name: string, content: string, folder?: string) => ipcRenderer.invoke('save-context-file', name, content, folder || ''),
  deleteContextFile: (name: string) => ipcRenderer.invoke('delete-context-file', name),
  createContextFolder: (relativePath: string) => ipcRenderer.invoke('create-context-folder', relativePath),
  deleteContextFolder: (relativePath: string) => ipcRenderer.invoke('delete-context-folder', relativePath),
  uploadContextFiles: (targetFolder: string) => ipcRenderer.invoke('upload-context-files', targetFolder),
  scaffoldDomainFolders: () => ipcRenderer.invoke('scaffold-domain-folders'),

  // Memory
  getMemories: () => ipcRenderer.invoke('get-memories'),
  createMemory: (memory: any) => ipcRenderer.invoke('create-memory', memory),
  updateMemory: (id: string, updates: any) => ipcRenderer.invoke('update-memory', id, updates),
  deleteMemory: (id: string) => ipcRenderer.invoke('delete-memory', id),
  archiveMemory: (id: string) => ipcRenderer.invoke('archive-memory', id),
  pinMemory: (id: string) => ipcRenderer.invoke('pin-memory', id),
  getMemoryTopics: () => ipcRenderer.invoke('get-memory-topics'),
  updateMemoryTopics: (topics: any[]) => ipcRenderer.invoke('update-memory-topics', topics),
  getMemorySettings: () => ipcRenderer.invoke('get-memory-settings'),
  saveMemorySettings: (settings: any) => ipcRenderer.invoke('save-memory-settings', settings),
  extractMemoriesFromChat: (conversationId: string) => ipcRenderer.invoke('extract-memories-from-chat', conversationId),
  extractMemoriesFromCli: (sessionId: string) => ipcRenderer.invoke('extract-memories-from-cli', sessionId),
  extractMemoriesFromJournal: (date: string) => ipcRenderer.invoke('extract-memories-from-journal', date),
  batchExtractMemories: () => ipcRenderer.invoke('batch-extract-memories'),

  // Knowledge Pack
  getKnowledgePacks: () => ipcRenderer.invoke('get-knowledge-packs'),
  compressKnowledge: () => ipcRenderer.invoke('compress-knowledge'),
  auditCompression: () => ipcRenderer.invoke('audit-compression'),

  // Lab tools
  compressSingleFile: (relativePath: string) => ipcRenderer.invoke('compress-single-file', relativePath),
  compressFolder: (folder: string) => ipcRenderer.invoke('compress-folder', folder),
  testEmbeddingSimilarity: (textA: string, textB: string) => ipcRenderer.invoke('test-embedding-similarity', textA, textB),
  listContextFiles: () => ipcRenderer.invoke('list-context-files'),
  getMemoryHealth: () => ipcRenderer.invoke('get-memory-health'),
  autoPruneMemories: () => ipcRenderer.invoke('auto-prune-memories'),
  startHealthMonitor: (intervalMs: number) => ipcRenderer.invoke('start-health-monitor', intervalMs),
  stopHealthMonitor: () => ipcRenderer.invoke('stop-health-monitor'),
  onCompressionProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress)
    ipcRenderer.on('compression-progress', handler)
    return () => { ipcRenderer.removeListener('compression-progress', handler) }
  },
  onMemoryHealthUpdate: (callback: (health: any) => void) => {
    const handler = (_: any, health: any) => callback(health)
    ipcRenderer.on('memory-health-update', handler)
    return () => { ipcRenderer.removeListener('memory-health-update', handler) }
  },

  // ChatGPT OAuth
  chatgptOAuthStart: () => ipcRenderer.invoke('chatgpt-oauth-start'),
  chatgptOAuthDisconnect: () => ipcRenderer.invoke('chatgpt-oauth-disconnect'),
  chatgptOAuthStatus: () => ipcRenderer.invoke('chatgpt-oauth-status'),
  chatgptOAuthRefresh: () => ipcRenderer.invoke('chatgpt-oauth-refresh'),

  // Agents
  getAgents: () => ipcRenderer.invoke('get-agents'),
  getAgent: (id: string) => ipcRenderer.invoke('get-agent', id),
  createAgent: (data: any) => ipcRenderer.invoke('create-agent', data),
  updateAgent: (id: string, updates: any) => ipcRenderer.invoke('update-agent', id, updates),
  deleteAgent: (id: string) => ipcRenderer.invoke('delete-agent', id),
  setAgentStatus: (id: string, status: string, lastError?: string) => ipcRenderer.invoke('set-agent-status', id, status, lastError),
  getAgentIssues: (filters?: any) => ipcRenderer.invoke('get-agent-issues', filters),
  getAgentIssue: (id: string) => ipcRenderer.invoke('get-agent-issue', id),
  createAgentIssue: (data: any) => ipcRenderer.invoke('create-agent-issue', data),
  updateAgentIssue: (id: string, updates: any) => ipcRenderer.invoke('update-agent-issue', id, updates),
  deleteAgentIssue: (id: string) => ipcRenderer.invoke('delete-agent-issue', id),
  getHeartbeatRuns: (filters?: any) => ipcRenderer.invoke('get-heartbeat-runs', filters),
  runAgentHeartbeat: (agentId: string, issueId?: string) => ipcRenderer.invoke('run-agent-heartbeat', agentId, issueId),
  completeHeartbeatRun: (runId: string, updates: any) => ipcRenderer.invoke('complete-heartbeat-run', runId, updates),
  getCostEvents: (filters?: any) => ipcRenderer.invoke('get-cost-events', filters),
  getAgentCostSummary: (agentId: string) => ipcRenderer.invoke('get-agent-cost-summary', agentId),
  pollAgentSessions: () => ipcRenderer.invoke('poll-agent-sessions'),
  getAgentEvents: (filters?: any) => ipcRenderer.invoke('get-agent-events', filters),
  onAgentsUpdated: (callback: () => void) => {
    ipcRenderer.on('agents-updated', callback)
    return () => ipcRenderer.removeListener('agents-updated', callback)
  },

  // AgentsView Analytics
  avPing: () => ipcRenderer.invoke('av-ping'),
  avGetStats: () => ipcRenderer.invoke('av-get-stats'),
  avGetSummary: (days?: number) => ipcRenderer.invoke('av-get-summary', days),
  avGetTools: (days?: number) => ipcRenderer.invoke('av-get-tools', days),
  avGetVelocity: (days?: number) => ipcRenderer.invoke('av-get-velocity', days),
  avGetHeatmap: () => ipcRenderer.invoke('av-get-heatmap'),
  avGetProjects: () => ipcRenderer.invoke('av-get-projects'),
  avGetSessions: () => ipcRenderer.invoke('av-get-sessions'),
  avGetTopSessions: () => ipcRenderer.invoke('av-get-top-sessions'),
  avGetSessionList: (opts?: { limit?: number; project?: string; search?: string }) => ipcRenderer.invoke('av-get-session-list', opts),
  avGetSessionDetail: (id: string) => ipcRenderer.invoke('av-get-session-detail', id),
  avGetSessionMessages: (id: string, limit?: number) => ipcRenderer.invoke('av-get-session-messages', id, limit),
  avGetInsights: () => ipcRenderer.invoke('av-get-insights'),
  avGetSyncStatus: () => ipcRenderer.invoke('av-get-sync-status'),
  avSync: (full?: boolean) => ipcRenderer.invoke('av-sync', full),
  avGenerateInsights: (type: string, dateFrom: string, dateTo: string) => ipcRenderer.invoke('av-generate-insights', type, dateFrom, dateTo),
  avSearch: (q: string, limit?: number) => ipcRenderer.invoke('av-search', q, limit),
  avGetActivity: (days?: number) => ipcRenderer.invoke('av-get-activity', days),
  avGetHourOfWeek: () => ipcRenderer.invoke('av-get-hour-of-week'),
  avGetSessionChildren: (id: string) => ipcRenderer.invoke('av-get-session-children', id),
  avExportSession: (id: string) => ipcRenderer.invoke('av-export-session', id),

  // AgentsView Process Management
  avProcessStart: () => ipcRenderer.invoke('av-process-start'),
  avProcessStop: () => ipcRenderer.invoke('av-process-stop'),
  avProcessStatus: () => ipcRenderer.invoke('av-process-status'),

  // Command Center
  ccLaunch: (opts: { projectPath: string; prompt: string; model?: string; maxBudget?: number; resumeSessionId?: string }) =>
    ipcRenderer.invoke('cc:launch', opts),
  ccRespond: (opts: { processId: string; response: string }) =>
    ipcRenderer.invoke('cc:respond', opts),
  ccDismiss: (opts: { processId: string }) =>
    ipcRenderer.invoke('cc:dismiss', opts),
  ccKill: (opts: { processId: string }) =>
    ipcRenderer.invoke('cc:kill', opts),
  ccGetQueue: () => ipcRenderer.invoke('cc:get-queue'),
  ccGetHistory: (opts?: { filter?: string; limit?: number }) =>
    ipcRenderer.invoke('cc:get-history', opts),
  ccGetProjects: () => ipcRenderer.invoke('cc:get-projects'),
  ccGetProjectDescription: (opts: { projectPath: string }) => ipcRenderer.invoke('cc:get-project-description', opts),
  ccBrowseProject: () => ipcRenderer.invoke('cc:browse-project'),
  ccCreateProject: (opts: { name: string }) => ipcRenderer.invoke('cc:create-project', opts),
  onCCQueueUpdate: (callback: (queue: any[]) => void) => {
    const handler = (_: any, queue: any[]) => callback(queue)
    ipcRenderer.on('cc:queue-update', handler)
    return () => { ipcRenderer.removeListener('cc:queue-update', handler) }
  },

  // Notifications
  showNotification: (title: string, body: string) => ipcRenderer.invoke('show-notification', title, body),

  // Open URL in browser
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Clipboard
  readClipboard: () => ipcRenderer.sendSync('read-clipboard'),
  writeClipboard: (text: string) => ipcRenderer.send('write-clipboard', text),

  // Window controls
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window')
})
