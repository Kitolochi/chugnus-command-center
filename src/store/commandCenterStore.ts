import { create } from 'zustand'
import type { CollabSession } from '../types'

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
  activeView: 'queue' | 'history' | 'collab' | 'codex'
  launchOpen: boolean
  projects: KnownProject[]

  // Collab state
  collabSession: CollabSession | null
  collabHistory: CollabSession[]

  // Codex chat state
  codexMessages: { role: 'user' | 'assistant'; content: string }[]
  codexProject: string | null
  codexProjectTree: string | null
  codexLoading: boolean

  // Actions
  loadQueue: () => Promise<void>
  loadHistory: (filter?: string | null) => Promise<void>
  loadProjects: () => Promise<void>
  launch: (projectPath: string, prompt: string, opts?: { model?: string; maxBudget?: number; resumeSessionId?: string }) => Promise<void>
  respond: (processId: string, response: string) => Promise<void>
  dismiss: (processId: string) => Promise<void>
  kill: (processId: string) => Promise<void>
  setActiveView: (view: 'queue' | 'history' | 'collab' | 'codex') => void
  setHistoryFilter: (filter: string | null) => void
  setLaunchOpen: (open: boolean) => void
  updateQueue: (queue: CCQueueItem[]) => void

  // Collab actions
  startCollab: (task: string, maxRounds?: number) => Promise<void>
  resumeCollab: (sessionId: string, maxRounds?: number) => Promise<void>
  respondCollab: (response: string) => Promise<void>
  killCollab: () => Promise<void>
  loadCollabHistory: () => Promise<void>
  updateCollabSession: (session: CollabSession) => void

  // Codex actions
  codexSetProject: (projectPath: string | null) => Promise<void>
  codexSend: (message: string) => Promise<void>
  codexClear: () => void
  codexAttachFile: (filePath: string) => Promise<void>
}

export const useCommandCenterStore = create<CommandCenterState>((set, get) => ({
  queue: [],
  history: [],
  historyFilter: null,
  activeView: 'queue',
  launchOpen: false,
  projects: [],
  collabSession: null,
  collabHistory: [],
  codexMessages: [],
  codexProject: null,
  codexProjectTree: null,
  codexLoading: false,

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

  // Collab actions
  startCollab: async (task, maxRounds) => {
    await window.electronAPI.collabStart({ task, maxRounds })
    const session = await window.electronAPI.collabGetSession()
    set({ collabSession: session })
  },

  resumeCollab: async (sessionId, maxRounds) => {
    await window.electronAPI.collabResume({ sessionId, maxRounds })
    const session = await window.electronAPI.collabGetSession()
    set({ collabSession: session })
  },

  respondCollab: async (response) => {
    const session = get().collabSession
    if (!session) return
    await window.electronAPI.collabRespond({ sessionId: session.id, response })
  },

  killCollab: async () => {
    const session = get().collabSession
    if (!session) return
    await window.electronAPI.collabKill({ sessionId: session.id })
    set({ collabSession: null })
    get().loadCollabHistory()
  },

  loadCollabHistory: async () => {
    const collabHistory = await window.electronAPI.collabGetHistory()
    set({ collabHistory })
  },

  updateCollabSession: (session) => {
    // If terminal state, clear active and refresh history
    if (session.status === 'completed' || session.status === 'killed' || session.status === 'errored') {
      set({ collabSession: null })
      get().loadCollabHistory()
    } else {
      set({ collabSession: session })
    }
  },

  // Codex actions
  codexSetProject: async (projectPath) => {
    if (!projectPath) {
      set({ codexProject: null, codexProjectTree: null })
      return
    }
    const tree = await window.electronAPI.codexReadTree({ projectPath })
    set({ codexProject: projectPath, codexProjectTree: tree })
  },

  codexSend: async (message) => {
    const { codexMessages, codexProject, codexProjectTree } = get()
    const userMsg = { role: 'user' as const, content: message }
    const updated = [...codexMessages, userMsg]
    set({ codexMessages: updated, codexLoading: true })

    try {
      // Build messages with optional project context
      const apiMessages: { role: string; content: string }[] = []
      if (codexProject && codexProjectTree) {
        apiMessages.push({
          role: 'user',
          content: `[Project context: ${codexProject}]\n\nFile tree:\n\`\`\`\n${codexProjectTree}\n\`\`\``,
        })
      }
      apiMessages.push(...updated.map(m => ({ role: m.role, content: m.content })))

      const { content } = await window.electronAPI.codexSend({ messages: apiMessages, projectPath: codexProject || undefined })
      const assistantMsg = { role: 'assistant' as const, content }
      set({ codexMessages: [...updated, assistantMsg], codexLoading: false })
    } catch (err: any) {
      const errorMsg = { role: 'assistant' as const, content: `Error: ${err.message}` }
      set({ codexMessages: [...updated, errorMsg], codexLoading: false })
    }
  },

  codexClear: () => set({ codexMessages: [], codexProject: null, codexProjectTree: null }),

  codexAttachFile: async (filePath) => {
    const content = await window.electronAPI.codexReadFile({ filePath })
    const fileName = filePath.split(/[/\\]/).pop() || filePath
    const fileMsg = { role: 'user' as const, content: `[File: ${fileName}]\n\`\`\`\n${content}\n\`\`\`` }
    set({ codexMessages: [...get().codexMessages, fileMsg] })
  },
}))
