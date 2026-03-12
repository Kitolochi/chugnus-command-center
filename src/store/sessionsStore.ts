import { create } from 'zustand'
import type {
  AVStats, AVSummary, AVTools, AVVelocity, AVHeatmap,
  AVProjects, AVSessions, AVTopSessions, AVSessionList,
  AVInsights, AVSyncStatus, AVSessionDetail, AVSessionMessages,
  AVActivity, AVHourOfWeek, AVSearchResults, AVSessionListItem,
} from '../types'

type SubView = 'overview' | 'tools' | 'velocity' | 'sessions' | 'insights'
type DateRange = 7 | 30 | 90 | null // null = all time
type AVProcessStatus = 'running' | 'stopped' | 'not-installed'

interface SessionsState {
  subView: SubView
  online: boolean | null
  loading: boolean
  error: string | null
  lastRefresh: number | null
  dateRange: DateRange
  syncing: boolean
  generatingInsights: boolean
  processStatus: AVProcessStatus
  startingProcess: boolean

  // Filters
  projectFilter: string | null
  searchQuery: string

  // Session detail
  selectedSessionId: string | null
  sessionDetail: AVSessionDetail | null
  sessionMessages: AVSessionMessages | null
  loadingDetail: boolean

  // Data
  stats: AVStats | null
  summary: AVSummary | null
  tools: AVTools | null
  velocity: AVVelocity | null
  heatmap: AVHeatmap | null
  projects: AVProjects | null
  sessions: AVSessions | null
  topSessions: AVTopSessions | null
  sessionList: AVSessionList | null
  insights: AVInsights | null
  syncStatus: AVSyncStatus | null
  activity: AVActivity | null
  hourOfWeek: AVHourOfWeek | null
  searchResults: AVSearchResults | null
  sessionChildren: AVSessionListItem[] | null

  // Actions
  setSubView: (v: SubView) => void
  setDateRange: (d: DateRange) => void
  setProjectFilter: (p: string | null) => void
  setSearchQuery: (q: string) => void
  checkOnline: () => Promise<boolean>
  loadAll: () => Promise<void>
  loadOverview: () => Promise<void>
  loadTools: () => Promise<void>
  loadVelocity: () => Promise<void>
  loadSessions: () => Promise<void>
  loadInsights: () => Promise<void>
  loadSessionList: () => Promise<void>
  selectSession: (id: string | null) => Promise<void>
  syncSessions: (full?: boolean) => Promise<void>
  generateInsights: (type?: string, dateFrom?: string, dateTo?: string) => Promise<void>
  loadActivity: () => Promise<void>
  loadHourOfWeek: () => Promise<void>
  searchMessages: (q: string) => Promise<void>
  loadSessionChildren: (id: string) => Promise<void>
  exportSession: (id: string) => Promise<string>
  checkProcessStatus: () => Promise<void>
  startProcess: () => Promise<void>
  stopProcess: () => Promise<void>
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  subView: 'overview',
  online: null,
  loading: false,
  error: null,
  lastRefresh: null,
  dateRange: null,
  syncing: false,
  generatingInsights: false,
  processStatus: 'stopped',
  startingProcess: false,

  projectFilter: null,
  searchQuery: '',

  selectedSessionId: null,
  sessionDetail: null,
  sessionMessages: null,
  loadingDetail: false,

  stats: null,
  summary: null,
  tools: null,
  velocity: null,
  heatmap: null,
  projects: null,
  sessions: null,
  topSessions: null,
  sessionList: null,
  insights: null,
  syncStatus: null,
  activity: null,
  hourOfWeek: null,
  searchResults: null,
  sessionChildren: null,

  setSubView: (v) => {
    set({ subView: v })
    const s = get()
    if (v === 'tools' && !s.tools) s.loadTools()
    else if (v === 'velocity' && !s.velocity) s.loadVelocity()
    else if (v === 'sessions' && !s.sessions) s.loadSessions()
    else if (v === 'insights' && !s.insights) s.loadInsights()
  },

  setDateRange: (d) => {
    set({ dateRange: d })
    // Reload data that supports date filtering
    const s = get()
    if (!s.online) return
    s.loadOverview()
    if (s.tools) s.loadTools()
    if (s.velocity) s.loadVelocity()
    if (s.activity) s.loadActivity()
  },

  setProjectFilter: (p) => {
    set({ projectFilter: p })
    get().loadSessionList()
  },

  setSearchQuery: (q) => {
    set({ searchQuery: q })
    get().loadSessionList()
  },

  checkOnline: async () => {
    try {
      const ok = await window.electronAPI.avPing()
      set({ online: ok })
      return ok
    } catch {
      set({ online: false })
      return false
    }
  },

  loadAll: async () => {
    set({ loading: true, error: null })
    await get().checkProcessStatus()
    const ok = await get().checkOnline()
    if (!ok) {
      set({ loading: false })
      return
    }
    try {
      const days = get().dateRange ?? undefined
      const [stats, summary, heatmap, projects, topSessions, syncStatus, activity, hourOfWeek] = await Promise.all([
        window.electronAPI.avGetStats(),
        window.electronAPI.avGetSummary(days),
        window.electronAPI.avGetHeatmap(),
        window.electronAPI.avGetProjects(),
        window.electronAPI.avGetTopSessions(),
        window.electronAPI.avGetSyncStatus(),
        window.electronAPI.avGetActivity(days),
        window.electronAPI.avGetHourOfWeek(),
      ])
      set({ stats, summary, heatmap, projects, topSessions, syncStatus, activity, hourOfWeek, lastRefresh: Date.now(), loading: false })
    } catch (e: any) {
      set({ error: e.message || 'Failed to load data', loading: false })
    }
  },

  loadOverview: async () => {
    set({ loading: true, error: null })
    try {
      const days = get().dateRange ?? undefined
      const [summary, heatmap, projects, topSessions, activity, hourOfWeek] = await Promise.all([
        window.electronAPI.avGetSummary(days),
        window.electronAPI.avGetHeatmap(),
        window.electronAPI.avGetProjects(),
        window.electronAPI.avGetTopSessions(),
        window.electronAPI.avGetActivity(days),
        window.electronAPI.avGetHourOfWeek(),
      ])
      set({ summary, heatmap, projects, topSessions, activity, hourOfWeek, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadTools: async () => {
    set({ loading: true, error: null })
    try {
      const days = get().dateRange ?? undefined
      const tools = await window.electronAPI.avGetTools(days)
      set({ tools, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadVelocity: async () => {
    set({ loading: true, error: null })
    try {
      const days = get().dateRange ?? undefined
      const velocity = await window.electronAPI.avGetVelocity(days)
      set({ velocity, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadSessions: async () => {
    set({ loading: true, error: null })
    try {
      const [sessions, sessionList] = await Promise.all([
        window.electronAPI.avGetSessions(),
        window.electronAPI.avGetSessionList({
          limit: 50,
          project: get().projectFilter ?? undefined,
          search: get().searchQuery || undefined,
        }),
      ])
      set({ sessions, sessionList, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadInsights: async () => {
    set({ loading: true, error: null })
    try {
      const [insights, syncStatus] = await Promise.all([
        window.electronAPI.avGetInsights(),
        window.electronAPI.avGetSyncStatus(),
      ])
      set({ insights, syncStatus, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadSessionList: async () => {
    try {
      const sessionList = await window.electronAPI.avGetSessionList({
        limit: 50,
        project: get().projectFilter ?? undefined,
        search: get().searchQuery || undefined,
      })
      set({ sessionList })
    } catch {}
  },

  selectSession: async (id) => {
    if (!id) {
      set({ selectedSessionId: null, sessionDetail: null, sessionMessages: null })
      return
    }
    set({ selectedSessionId: id, loadingDetail: true })
    try {
      const [sessionDetail, sessionMessages] = await Promise.all([
        window.electronAPI.avGetSessionDetail(id),
        window.electronAPI.avGetSessionMessages(id, 200),
      ])
      set({ sessionDetail, sessionMessages, loadingDetail: false })
    } catch (e: any) {
      set({ error: e.message, loadingDetail: false })
    }
  },

  syncSessions: async (full) => {
    set({ syncing: true, error: null })
    try {
      await window.electronAPI.avSync(full)
      set({ syncing: false })
      get().loadAll()
    } catch (e: any) {
      set({ syncing: false, error: e.message })
    }
  },

  generateInsights: async (type, dateFrom, dateTo) => {
    set({ generatingInsights: true, error: null })
    try {
      const today = new Date().toISOString().split('T')[0]
      await window.electronAPI.avGenerateInsights(
        type || 'daily_activity',
        dateFrom || today,
        dateTo || today,
      )
      set({ generatingInsights: false })
      get().loadInsights()
    } catch (e: any) {
      set({ generatingInsights: false, error: e.message })
    }
  },

  loadActivity: async () => {
    try {
      const days = get().dateRange ?? undefined
      const activity = await window.electronAPI.avGetActivity(days)
      set({ activity })
    } catch {}
  },

  loadHourOfWeek: async () => {
    try {
      const hourOfWeek = await window.electronAPI.avGetHourOfWeek()
      set({ hourOfWeek })
    } catch {}
  },

  searchMessages: async (q) => {
    if (!q.trim()) {
      set({ searchResults: null })
      return
    }
    try {
      const searchResults = await window.electronAPI.avSearch(q, 20)
      set({ searchResults })
    } catch {}
  },

  loadSessionChildren: async (id) => {
    try {
      const sessionChildren = await window.electronAPI.avGetSessionChildren(id)
      set({ sessionChildren })
    } catch {
      set({ sessionChildren: null })
    }
  },

  exportSession: async (id) => {
    return window.electronAPI.avExportSession(id)
  },

  checkProcessStatus: async () => {
    try {
      const processStatus = await window.electronAPI.avProcessStatus()
      set({ processStatus })
    } catch {
      set({ processStatus: 'stopped' })
    }
  },

  startProcess: async () => {
    set({ startingProcess: true, error: null })
    try {
      const ok = await window.electronAPI.avProcessStart()
      set({ startingProcess: false, processStatus: ok ? 'running' : 'stopped' })
      if (ok) {
        await get().checkOnline()
        get().loadAll()
      }
    } catch (e: any) {
      set({ startingProcess: false, error: e.message || 'Failed to start AgentsView' })
    }
  },

  stopProcess: async () => {
    try {
      await window.electronAPI.avProcessStop()
      set({ online: false, processStatus: 'stopped' })
    } catch {}
  },
}))
