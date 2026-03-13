import { create } from 'zustand'

type Tab = 'command-center' | 'agents' | 'memories' | 'sessions' | 'memory' | 'lab' | 'settings' | 'pomodoro'

interface AppState {
  activeTab: Tab
  expandedGroup: string | null

  setActiveTab: (tab: Tab) => void
  setExpandedGroup: (group: string | null) => void
  navigateToTab: (tab: Tab) => void
}

export type { Tab }

export const TAB_GROUPS: { id: string; label: string; tabs: { id: Tab; label: string; shortcut?: string }[] }[] = [
  {
    id: 'command', label: 'Command',
    tabs: [
      { id: 'command-center', label: 'Command', shortcut: 'x' },
    ]
  },
  {
    id: 'aiknowledge', label: 'AI & Knowledge',
    tabs: [
      { id: 'agents', label: 'Agents' },
      { id: 'memories', label: 'Memories' },
      { id: 'sessions', label: 'Sessions' },
      { id: 'memory', label: 'Context' },
      { id: 'lab', label: 'Lab' },
    ]
  },
  {
    id: 'productivity', label: 'Productivity',
    tabs: [
      { id: 'pomodoro', label: 'Focus' },
    ]
  },
  {
    id: 'settings', label: '',
    tabs: [
      { id: 'settings', label: 'Settings', shortcut: 's' },
    ]
  },
]

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'command-center',
  expandedGroup: 'command',

  setActiveTab: (tab) => set({ activeTab: tab }),
  setExpandedGroup: (group) => set({ expandedGroup: group }),
  navigateToTab: (tab) => set({ activeTab: tab }),
}))
