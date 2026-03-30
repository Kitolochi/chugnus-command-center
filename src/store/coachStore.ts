import { create } from 'zustand'
import type { CoachTip } from '../types'

interface CoachStoreState {
  enabled: boolean
  status: 'active' | 'analyzing' | 'offline' | 'disabled'
  tips: CoachTip[]
  daySummary: string
  sessionCount: number
  panelOpen: boolean
  focusedSessionId: string | null

  toggleEnabled: () => void
  togglePanel: () => void
  dismissTip: (id: string) => void
  saveTip: (id: string) => void
  clearDay: () => void
  setTips: (tips: CoachTip[]) => void
  setStatus: (status: CoachStoreState['status']) => void
  setSessionCount: (count: number) => void
  setDaySummary: (summary: string) => void
  setFocusedSessionId: (id: string | null) => void
}

export const useCoachStore = create<CoachStoreState>((set, get) => ({
  enabled: true,
  status: 'active',
  tips: [],
  daySummary: '',
  sessionCount: 0,
  panelOpen: false,
  focusedSessionId: null,

  toggleEnabled: () => {
    const next = !get().enabled
    set({ enabled: next })
    window.electronAPI.coachToggle(next)
  },

  togglePanel: () => set(s => ({ panelOpen: !s.panelOpen })),

  dismissTip: (id) => set(s => ({
    tips: s.tips.map(t => t.id === id ? { ...t, dismissed: true } : t),
  })),

  saveTip: (id) => {
    const tip = get().tips.find(t => t.id === id)
    if (tip) {
      window.electronAPI.coachSaveTip(tip)
      set(s => ({
        tips: s.tips.map(t => t.id === id ? { ...t, saved: true } : t),
      }))
    }
  },

  clearDay: () => {
    window.electronAPI.coachClearDay()
    set({ tips: [], daySummary: '' })
  },

  setTips: (tips) => set({ tips }),
  setStatus: (status) => set({ status }),
  setSessionCount: (count) => set({ sessionCount: count }),
  setDaySummary: (summary) => set({ daySummary: summary }),
  setFocusedSessionId: (id) => set({ focusedSessionId: id }),
}))
