import { create } from 'zustand'
import { useCommandCenterStore } from './commandCenterStore'
import type { CodexSession, CodexStatus, CodexTurnOptions } from '../types/codex'

interface CodexState {
  sessions: CodexSession[]
  selectedId: string | null
  history: boolean
  selectedProject: string | null
  launchOpen: boolean
  launchProject: string | null
  status: CodexStatus | null
  error: string | null
  sending: boolean
  update: (session: CodexSession) => void
  load: () => Promise<void>
  select: (id: string | null) => void
  newTask: (projectPath?: string) => void
  send: (options: CodexTurnOptions) => Promise<boolean>
  stop: (id: string) => Promise<void>
  archive: (id: string, archived: boolean, disposition?: 'parked' | 'completed' | 'killed') => Promise<void>
}

export const useCodexStore = create<CodexState>((set, get) => ({
  sessions: [],
  selectedProject: null,
  launchOpen: false,
  launchProject: null,
  selectedId: null,
  history: false,
  status: null,
  error: null,
  sending: false,
  update: (session) =>
    set((state) => {
      const current = state.sessions.find((s) => s.id === session.id)
      if (current && current.updatedAt > session.updatedAt) return state
      return {
        sessions: [session, ...state.sessions.filter((s) => s.id !== session.id)].sort(
          (a, b) => b.updatedAt - a.updatedAt
        ),
      }
    }),
  load: async () => {
    set({ error: null })
    const [sessions, status] = await Promise.allSettled([
      window.electronAPI.codexSessions(),
      window.electronAPI.codexStatus(),
    ])
    if (sessions.status === 'fulfilled') sessions.value.forEach(get().update)
    else set({ error: String(sessions.reason) })
    if (status.status === 'fulfilled') set({ status: status.value })
    else set({ status: { available: false, error: String(status.reason) } })
  },
  select: (selectedId) => {
    const session = get().sessions.find((s) => s.id === selectedId)
    set({ selectedId, selectedProject: session?.projectPath ?? null, history: false, error: null })
    if (session) {
      useCommandCenterStore.setState({ selectedProject: session.projectPath, focusId: selectedId, activeView: 'codex' })
    }
  },
  newTask: (projectPath) => set({ launchOpen: true, launchProject: projectPath ?? get().selectedProject, error: null }),
  send: async (options) => {
    if (get().sending) return false
    set({ sending: true, error: null })
    try {
      const session = await window.electronAPI.codexTurn(options)
      get().update(session)
      get().select(session.id)
      set({ selectedId: session.id, selectedProject: session.projectPath, history: false, launchOpen: false })
      return true
    } catch (error) {
      set({ error: String(error) })
      return false
    } finally {
      set({ sending: false })
    }
  },
  stop: async (id) => {
    try {
      await window.electronAPI.codexStop(id)
    } catch (error) {
      set({ error: String(error) })
    }
  },
  archive: async (id, archived, disposition = 'parked') => {
    try {
      if (archived && get().sessions.find((s) => s.id === id)?.status === 'working') {
        await window.electronAPI.codexStop(id)
        const deadline = Date.now() + 15000
        while (true) {
          const sessions = await window.electronAPI.codexSessions()
          sessions.forEach(get().update)
          if (sessions.find((s) => s.id === id)?.status !== 'working') break
          if (Date.now() > deadline) throw new Error('Codex is still stopping. Try again in a moment.')
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }
      await window.electronAPI.codexArchive(id, archived, disposition)
      ;(await window.electronAPI.codexSessions()).forEach(get().update)
      if (!archived) get().select(id)
      set({
        selectedId: archived ? null : id,
        history: false,
        ...(!archived ? { selectedProject: get().sessions.find((s) => s.id === id)?.projectPath ?? null } : {}),
      })
    } catch (error) {
      set({ error: String(error) })
    }
  },
}))
