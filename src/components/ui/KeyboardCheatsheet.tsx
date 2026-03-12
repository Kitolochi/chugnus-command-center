import { useState, useEffect, useCallback } from 'react'
import { TAB_GROUPS } from '../../store/appStore'

interface ShortcutEntry {
  key: string
  label: string
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutEntry[]
}

function buildShortcutGroups(): ShortcutGroup[] {
  const groups: ShortcutGroup[] = []

  // Pull tab shortcuts from TAB_GROUPS
  for (const group of TAB_GROUPS) {
    if (!group.label) continue // skip the empty-label settings group — we add it manually below
    const shortcuts: ShortcutEntry[] = []
    for (const tab of group.tabs) {
      if (tab.shortcut) {
        shortcuts.push({ key: tab.shortcut.toUpperCase(), label: tab.label })
      }
    }
    if (shortcuts.length > 0) {
      groups.push({ title: group.label, shortcuts })
    }
  }

  // Settings tab (from the empty-label group)
  const settingsGroup = TAB_GROUPS.find(g => g.id === 'settings')
  if (settingsGroup) {
    const settingsTab = settingsGroup.tabs.find(t => t.shortcut)
    if (settingsTab?.shortcut) {
      // Append to last real group or create standalone
      groups.push({
        title: 'System',
        shortcuts: [{ key: settingsTab.shortcut.toUpperCase(), label: settingsTab.label }],
      })
    }
  }

  // Global actions (from useKeyboardShortcuts)
  groups.push({
    title: 'Actions',
    shortcuts: [
      { key: 'N', label: 'New task' },
      { key: 'V', label: 'Voice toggle' },
      { key: 'Shift+V', label: 'Voice chat' },
      { key: 'P', label: 'Pomodoro toggle' },
      { key: '1-7', label: 'Select category (Dashboard)' },
      { key: 'Esc', label: 'Close modal / deselect' },
      { key: '?', label: 'This cheatsheet' },
    ],
  })

  return groups
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-white/[0.08] border border-white/[0.12] text-[11px] font-mono font-medium text-white/70 shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
      {children}
    </kbd>
  )
}

export default function KeyboardCheatsheet() {
  const [open, setOpen] = useState(false)
  const groups = buildShortcutGroups()

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger from input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(prev => !prev)
        return
      }

      if (e.key === 'Escape' && open) {
        e.stopPropagation()
        setOpen(false)
      }
    }

    // Use capture phase so we intercept before the main shortcuts hook
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={close}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 animate-slide-up">
        <div className="rounded-2xl border border-white/[0.08] bg-surface-1/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 className="text-base font-display font-semibold text-white/90 tracking-tight">
              Keyboard Shortcuts
            </h2>
            <button
              onClick={close}
              className="text-white/30 hover:text-white/60 transition-colors text-sm leading-none p-1 -mr-1"
              aria-label="Close"
            >
              <Kbd>Esc</Kbd>
            </button>
          </div>

          {/* Shortcut groups */}
          <div className="px-6 pb-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {groups.map(group => (
              <div key={group.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.shortcuts.map(shortcut => (
                    <div
                      key={shortcut.key + shortcut.label}
                      className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                    >
                      <span className="text-sm text-white/60">{shortcut.label}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.key.includes('+') ? (
                          shortcut.key.split('+').map((part, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && <span className="text-white/20 text-[10px]">+</span>}
                              <Kbd>{part}</Kbd>
                            </span>
                          ))
                        ) : (
                          <Kbd>{shortcut.key}</Kbd>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.02]">
            <p className="text-[11px] text-white/25 text-center">
              Press <Kbd>?</Kbd> to toggle this overlay
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
