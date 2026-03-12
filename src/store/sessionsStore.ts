import { create } from 'zustand'
import type {
  AVStats, AVSummary, AVTools, AVHeatmap,
  AVProjects, AVSessions, AVTopSessions, AVSessionList,
  AVSessionDetail, AVSessionMessages,
  AVActivity, AVHourOfWeek, AVSearchResults, AVSessionListItem,
} from '../types'

type SubView = 'overview' | 'tools' | 'sessions'
type DateRange = 7 | 30 | 90 | null // null = all time

interface SessionsState {
  subView: SubView
  loading: boolean
  error: string | null
  lastRefresh: number | null
  dateRange: DateRange

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
  summary: (AVSummary & { total_cost?: number; total_commits?: number }) | null
  tools: AVTools | null
  heatmap: AVHeatmap | null
  projects: AVProjects | null
  sessions: AVSessions | null
  topSessions: AVTopSessions | null
  sessionList: AVSessionList | null
  activity: AVActivity | null
  hourOfWeek: AVHourOfWeek | null
  searchResults: AVSearchResults | null
  sessionChildren: AVSessionListItem[] | null

  // Actions
  setSubView: (v: SubView) => void
  setDateRange: (d: DateRange) => void
  setProjectFilter: (p: string | null) => void
  setSearchQuery: (q: string) => void
  loadAll: () => Promise<void>
  loadOverview: () => Promise<void>
  loadTools: () => Promise<void>
  loadSessions: () => Promise<void>
  loadSessionList: () => Promise<void>
  selectSession: (id: string | null) => Promise<void>
  loadActivity: () => Promise<void>
  loadHourOfWeek: () => Promise<void>
  searchMessages: (q: string) => Promise<void>
  loadSessionChildren: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  subView: 'overview',
  loading: false,
  error: null,
  lastRefresh: null,
  dateRange: null,

  projectFilter: null,
  searchQuery: '',

  selectedSessionId: null,
  sessionDetail: null,
  sessionMessages: null,
  loadingDetail: false,

  stats: null,
  summary: null,
  tools: null,
  heatmap: null,
  projects: null,
  sessions: null,
  topSessions: null,
  sessionList: null,
  activity: null,
  hourOfWeek: null,
  searchResults: null,
  sessionChildren: null,

  setSubView: (v) => {
    set({ subView: v })
    const s = get()
    if (v === 'tools' && !s.tools) s.loadTools()
    else if (v === 'sessions' && !s.sessions) s.loadSessions()
  },

  setDateRange: (d) => {
    set({ dateRange: d })
    const s = get()
    s.loadOverview()
    if (s.tools) s.loadTools()
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

  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const days = get().dateRange ?? undefined
      const [stats, summary, heatmap, projects, topSessions, activity, hourOfWeek] = await Promise.all([
        window.electronAPI.avGetStats(),
        window.electronAPI.avGetSummary(days),
        window.electronAPI.avGetHeatmap(),
        window.electronAPI.avGetProjects(),
        window.electronAPI.avGetTopSessions(),
        window.electronAPI.avGetActivity(days),
        window.electronAPI.avGetHourOfWeek(),
      ])
      set({ stats, summary, heatmap, projects, topSessions, activity, hourOfWeek, lastRefresh: Date.now(), loading: false })
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

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      await window.electronAPI.avRefresh()
      await get().loadAll()
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },
}))
