import { useState, useMemo, useCallback } from 'react'
import { useAppStore } from '../store'
import type { Tab } from '../store'

export interface CommandItem {
  id: string
  type: 'tab' | 'action'
  title: string
  subtitle?: string
  icon?: string
  action: () => void
}

function fuzzyMatch(query: string, text: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

const TAB_COMMANDS: { id: Tab; label: string; group: string }[] = [
  { id: 'command-center', label: 'Command Center', group: 'Command' },
  { id: 'agents', label: 'Agents', group: 'AI & Knowledge' },
  { id: 'memories', label: 'Memories', group: 'AI & Knowledge' },
  { id: 'sessions', label: 'Sessions', group: 'AI & Knowledge' },
  { id: 'memory', label: 'Context Files', group: 'AI & Knowledge' },
  { id: 'lab', label: 'Lab', group: 'AI & Knowledge' },
  { id: 'settings', label: 'Settings', group: 'Settings' },
]

export function useCommandPalette() {
  const [query, setQuery] = useState('')

  const items = useMemo((): CommandItem[] => {
    const results: CommandItem[] = []

    for (const tab of TAB_COMMANDS) {
      results.push({
        id: `tab-${tab.id}`,
        type: 'tab',
        title: tab.label,
        subtitle: tab.group,
        action: () => useAppStore.getState().navigateToTab(tab.id),
      })
    }

    return results
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 15)
    return items.filter(item =>
      fuzzyMatch(query, item.title) || (item.subtitle && fuzzyMatch(query, item.subtitle))
    ).slice(0, 15)
  }, [query, items])

  const reset = useCallback(() => setQuery(''), [])

  return { query, setQuery, items: filtered, reset }
}
