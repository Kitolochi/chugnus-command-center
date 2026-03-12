import { create } from 'zustand'
import { Agent, AgentIssue, HeartbeatRun, CostEvent, AgentEvent } from '../types'

type SubView = 'overview' | 'issues' | 'costs' | 'history' | 'activity'

interface AgentState {
  agents: Agent[]
  issues: AgentIssue[]
  runs: HeartbeatRun[]
  costEvents: CostEvent[]
  events: AgentEvent[]
  selectedAgentId: string | null
  subView: SubView
  showForm: boolean
  editingAgent: Agent | null
  showIssueForm: boolean

  setSubView: (view: SubView) => void
  setSelectedAgentId: (id: string | null) => void
  setShowForm: (show: boolean) => void
  setEditingAgent: (agent: Agent | null) => void
  setShowIssueForm: (show: boolean) => void

  loadAll: () => Promise<void>
  loadAgents: () => Promise<void>
  loadIssues: () => Promise<void>
  loadRuns: () => Promise<void>
  loadCosts: () => Promise<void>
  loadEvents: () => Promise<void>
  createAgent: (data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'spentMonthlyCents' | 'budgetResetDate' | 'status'>) => Promise<Agent>
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>
  deleteAgent: (id: string) => Promise<void>
  setAgentStatus: (id: string, status: Agent['status']) => Promise<void>
  runAgentHeartbeat: (agentId: string, issueId?: string) => Promise<void>
  createIssue: (data: Omit<AgentIssue, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AgentIssue>
  updateIssue: (id: string, updates: Partial<AgentIssue>) => Promise<void>
  deleteIssue: (id: string) => Promise<void>
  completeRun: (runId: string, updates: Partial<HeartbeatRun>) => Promise<void>
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  issues: [],
  runs: [],
  costEvents: [],
  events: [],
  selectedAgentId: null,
  subView: 'overview',
  showForm: false,
  editingAgent: null,
  showIssueForm: false,

  setSubView: (view) => set({ subView: view }),
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  setShowForm: (show) => set({ showForm: show }),
  setEditingAgent: (agent) => set({ editingAgent: agent, showForm: !!agent }),
  setShowIssueForm: (show) => set({ showIssueForm: show }),

  loadAll: async () => {
    const { loadAgents, loadIssues, loadRuns, loadCosts, loadEvents } = get()
    await Promise.all([loadAgents(), loadIssues(), loadRuns(), loadCosts(), loadEvents()])
  },

  loadAgents: async () => {
    const agents = await window.electronAPI.getAgents()
    set({ agents })
  },

  loadIssues: async () => {
    const issues = await window.electronAPI.getAgentIssues()
    set({ issues })
  },

  loadRuns: async () => {
    const runs = await window.electronAPI.getHeartbeatRuns({ limit: 100 })
    set({ runs })
  },

  loadCosts: async () => {
    const costEvents = await window.electronAPI.getCostEvents({ limit: 200 })
    set({ costEvents })
  },

  loadEvents: async () => {
    const events = await window.electronAPI.getAgentEvents({ limit: 200 })
    set({ events })
  },

  createAgent: async (data) => {
    const agent = await window.electronAPI.createAgent(data)
    await get().loadAgents()
    return agent
  },

  updateAgent: async (id, updates) => {
    await window.electronAPI.updateAgent(id, updates)
    await get().loadAgents()
  },

  deleteAgent: async (id) => {
    await window.electronAPI.deleteAgent(id)
    const { selectedAgentId } = get()
    if (selectedAgentId === id) set({ selectedAgentId: null })
    await get().loadAll()
  },

  setAgentStatus: async (id, status) => {
    await window.electronAPI.setAgentStatus(id, status)
    await get().loadAgents()
  },

  runAgentHeartbeat: async (agentId, issueId) => {
    await window.electronAPI.runAgentHeartbeat(agentId, issueId)
    await get().loadAll()
  },

  createIssue: async (data) => {
    const issue = await window.electronAPI.createAgentIssue(data)
    await get().loadIssues()
    return issue
  },

  updateIssue: async (id, updates) => {
    await window.electronAPI.updateAgentIssue(id, updates)
    await get().loadIssues()
  },

  deleteIssue: async (id) => {
    await window.electronAPI.deleteAgentIssue(id)
    await get().loadIssues()
  },

  completeRun: async (runId, updates) => {
    await window.electronAPI.completeHeartbeatRun(runId, updates)
    await get().loadAll()
  },
}))
