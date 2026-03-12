import { create } from 'zustand'

export interface CCQueueItem {
  processId: string
  sessionId?: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  status: 'working' | 'awaiting_input' | 'errored'
  resultText?: string
  errorMessage?: string
  filesChanged: string[]
  fullLog: CCStreamMessage[]
  costUsd: number
  turnCount: number
  startedAt: number
  updatedAt: number
}

export interface CCStreamMessage {
  type: string
  subtype?: string
  text?: string
  toolName?: string
  toolInput?: string
  timestamp: number
}

export interface CCHistoryEntry {
  id: string
  sessionId?: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  summary: string
  status: 'running' | 'completed' | 'killed'
  filesChanged: string[]
  costUsd: number
  turnCount: number
  startedAt: number
  completedAt: number
}

interface KnownProject {
  path: string
  name: string
  lastUsed: number
}

interface CommandCenterState {
  queue: CCQueueItem[]
  history: CCHistoryEntry[]
  historyFilter: string | null
  activeView: 'queue' | 'history'
  launchOpen: boolean
  projects: KnownProject[]

  // Actions
  loadQueue: () => Promise<void>
  loadHistory: (filter?: string | null) => Promise<void>
  loadProjects: () => Promise<void>
  launch: (projectPath: string, prompt: string, opts?: { model?: string; maxBudget?: number; resumeSessionId?: string }) => Promise<void>
  respond: (processId: string, response: string) => Promise<void>
  dismiss: (processId: string) => Promise<void>
  kill: (processId: string) => Promise<void>
  setActiveView: (view: 'queue' | 'history') => void
  setHistoryFilter: (filter: string | null) => void
  setLaunchOpen: (open: boolean) => void
  updateQueue: (queue: CCQueueItem[]) => void
}

export const useCommandCenterStore = create<CommandCenterState>((set, get) => ({
  queue: [],
  history: [],
  historyFilter: null,
  activeView: 'queue',
  launchOpen: false,
  projects: [],

  loadQueue: async () => {
    const queue = await window.electronAPI.ccGetQueue()
    set({ queue })
  },

  loadHistory: async (filter) => {
    const f = filter !== undefined ? filter : get().historyFilter
    const history = await window.electronAPI.ccGetHistory({ filter: f || undefined })
    set({ history, historyFilter: f ?? null })
  },

  loadProjects: async () => {
    const projects = await window.electronAPI.ccGetProjects()
    set({ projects })
  },

  launch: async (projectPath, prompt, opts) => {
    await window.electronAPI.ccLaunch({ projectPath, prompt, ...opts })
    set({ launchOpen: false })
  },

  respond: async (processId, response) => {
    await window.electronAPI.ccRespond({ processId, response })
  },

  dismiss: async (processId) => {
    await window.electronAPI.ccDismiss({ processId })
    // Reload history since a new entry was added
    get().loadHistory()
  },

  kill: async (processId) => {
    await window.electronAPI.ccKill({ processId })
  },

  setActiveView: (view) => set({ activeView: view }),
  setHistoryFilter: (filter) => {
    set({ historyFilter: filter })
    get().loadHistory(filter)
  },
  setLaunchOpen: (open) => set({ launchOpen: open }),
  updateQueue: (queue) => set({ queue }),
}))
