import { create } from 'zustand'
import type { CodexSession, CodexStatus, CodexTurnOptions } from '../types/codex'

interface CodexState {
  sessions: CodexSession[]
  selectedId: string | null
  history: boolean
  status: CodexStatus | null
  error: string | null
  sending: boolean
  update: (session: CodexSession) => void
  load: () => Promise<void>
  select: (id: string | null) => void
  newTask: () => void
  send: (options: CodexTurnOptions) => Promise<boolean>
  stop: (id: string) => Promise<void>
  archive: (id: string, archived: boolean) => Promise<void>
}

export const useCodexStore = create<CodexState>((set, get) => ({
  sessions: [], selectedId: null, history: false, status: null, error: null, sending: false,
  update: session => set(state => {
    const current = state.sessions.find(s => s.id === session.id)
    if (current && current.updatedAt > session.updatedAt) return state
    return { sessions: [session, ...state.sessions.filter(s => s.id !== session.id)].sort((a, b) => b.updatedAt - a.updatedAt) }
  }),
  load: async () => {
    set({ error: null })
    const [sessions, status] = await Promise.allSettled([window.electronAPI.codexSessions(), window.electronAPI.codexStatus()])
    if (sessions.status === 'fulfilled') sessions.value.forEach(get().update)
    else set({ error: String(sessions.reason) })
    if (status.status === 'fulfilled') set({ status: status.value })
    else set({ status: { available: false, error: String(status.reason) } })
  },
  select: selectedId => set({ selectedId, error: null }),
  newTask: () => set({ selectedId: null, history: false, error: null }),
  send: async options => {
    if (get().sending) return false
    set({ sending: true, error: null })
    try {
      const session = await window.electronAPI.codexTurn(options)
      get().update(session)
      set({ selectedId: session.id, history: false })
      return true
    } catch (error) {
      set({ error: String(error) })
      return false
    } finally { set({ sending: false }) }
  },
  stop: async id => {
    try { await window.electronAPI.codexStop(id) } catch (error) { set({ error: String(error) }) }
  },
  archive: async (id, archived) => {
    try {
      await window.electronAPI.codexArchive(id, archived)
      set({ selectedId: archived ? null : id, history: false })
    } catch (error) { set({ error: String(error) }) }
  },
}))
