import { useState, useEffect, useRef } from 'react'
import { useCommandPalette } from '../hooks/useCommandPalette'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { playModalOpen, playModalClose, playClick } from '../utils/sounds'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { query, setQuery, items, reset } = useCommandPalette()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const trapRef = useFocusTrap(open)

  // Ctrl+K / Cmd+K to toggle
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      reset()
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
      playModalOpen()
    }
  }, [open, reset])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleClose = () => {
    setOpen(false)
    reset()
    playModalClose()
  }

  const handleSelect = (index: number) => {
    const item = items[index]
    if (item) {
      playClick()
      item.action()
      handleClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(selectedIndex)
    } else if (e.key === 'Escape') {
      handleClose()
    }
  }

  if (!open) return null

  const typeIcons: Record<string, React.ReactNode> = {
    tab: (
      <svg className="w-3.5 h-3.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
      </svg>
    ),
    task: (
      <svg className="w-3.5 h-3.5 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    action: (
      <svg className="w-3.5 h-3.5 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" onClick={handleClose} />

      {/* Palette */}
      <div
        ref={trapRef}
        className="relative z-10 w-full max-w-md mx-4 glass-card-elevated rounded-2xl overflow-hidden shadow-2xl shadow-black/50 animate-scale-in-bounce"
        onKeyDown={handleKeyDown}
      >
        {/* Gradient accent */}
        <div className="h-[2px] gradient-bar" />

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <svg className="w-4 h-4 text-accent-blue shrink-0 animate-pulse-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tabs, tasks, commands..."
            className="flex-1 bg-transparent border-none text-sm text-white/90 focus:outline-none placeholder-muted/50"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-[9px] text-muted font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-auto py-1.5">
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11px] text-muted">No results found</div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.id}
                onClick={() => handleSelect(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 ${
                  i === selectedIndex ? 'bg-accent-blue/10 border-l-2 border-accent-blue' : 'hover:bg-white/[0.04] border-l-2 border-transparent'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                  {typeIcons[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-medium truncate ${i === selectedIndex ? 'text-white' : 'text-white/80'}`}>
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="text-[10px] text-muted truncate">{item.subtitle}</p>
                  )}
                </div>
                {i === selectedIndex && (
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-[9px] text-muted font-mono shrink-0">Enter</kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/[0.04] flex items-center gap-3">
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-surface-3 text-[8px] text-muted font-mono">↑↓</kbd>
            <span className="text-[9px] text-muted">navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-surface-3 text-[8px] text-muted font-mono">↵</kbd>
            <span className="text-[9px] text-muted">select</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-surface-3 text-[8px] text-muted font-mono">esc</kbd>
            <span className="text-[9px] text-muted">close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
