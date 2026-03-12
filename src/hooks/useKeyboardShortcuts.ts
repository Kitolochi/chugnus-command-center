import { useEffect } from 'react'
import { useAppStore } from '../store'
import type { Tab } from '../store'

const TAB_SHORTCUTS: Record<string, Tab> = {
  x: 'command-center',
  s: 'settings',
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return
      }

      const { navigateToTab } = useAppStore.getState()

      const tab = TAB_SHORTCUTS[e.key]
      if (tab && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        navigateToTab(tab)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
