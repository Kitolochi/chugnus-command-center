import { useState, useEffect, useCallback } from 'react'
import AIProviderSettings from './AIProviderSettings'
import ChatGPTSettings from './ChatGPTSettings'

const SHORTCUTS = [
  { key: 'X', label: 'Command Center' },
  { key: 'S', label: 'Settings' },
  { key: 'Ctrl+K', label: 'Command Palette' },
  { key: 'Esc', label: 'Close' },
]

/** Convert a KeyboardEvent into an Electron accelerator string */
function keyEventToAccelerator(e: KeyboardEvent): string | null {
  // Ignore bare modifier presses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  // Require at least one modifier
  if (parts.length === 0) return null

  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key === 'ArrowUp') key = 'Up'
  else if (key === 'ArrowDown') key = 'Down'
  else if (key === 'ArrowLeft') key = 'Left'
  else if (key === 'ArrowRight') key = 'Right'
  else if (key === 'Escape') key = 'Esc'
  else if (key === 'Delete') key = 'Delete'
  else if (key === 'Backspace') key = 'Backspace'
  else if (key === 'Enter') key = 'Return'
  else if (key === 'Tab') key = 'Tab'
  else if (key.length === 1) key = key.toUpperCase()

  parts.push(key)
  return parts.join('+')
}

/** Format an Electron accelerator for display */
function formatAccelerator(accel: string): string {
  return accel
    .replace('CommandOrControl', navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl')
    .replace(/\+/g, ' + ')
}

function HotkeyRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const accel = keyEventToAccelerator(e)
    if (accel) {
      setPending(accel)
      setRecording(false)
    }
  }, [])

  useEffect(() => {
    if (!recording) return
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recording, handleKeyDown])

  useEffect(() => {
    if (pending) {
      onChange(pending)
      setPending(null)
    }
  }, [pending, onChange])

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-white/60">{label}</span>
      <div className="flex items-center gap-2">
        <kbd className="px-2 py-0.5 rounded-md bg-surface-3 border border-white/[0.06] text-white/50 font-mono text-[10px]">
          {recording ? 'Press keys...' : formatAccelerator(value)}
        </kbd>
        <button
          onClick={() => setRecording(!recording)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
            recording
              ? 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30'
              : 'bg-surface-3 text-white/40 border border-white/[0.06] hover:text-white/60'
          }`}
        >
          {recording ? 'Cancel' : 'Record'}
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const [voiceHotkey, setVoiceHotkey] = useState('CommandOrControl+Shift+Space')
  const [hotkeyError, setHotkeyError] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.getHotkeySettings().then(s => setVoiceHotkey(s.voiceToggle))
  }, [])

  const handleHotkeyChange = useCallback(async (newAccel: string) => {
    setHotkeyError(null)
    try {
      const result = await window.electronAPI.saveHotkeySettings({ voiceToggle: newAccel })
      setVoiceHotkey(result.voiceToggle)
    } catch (err: any) {
      setHotkeyError(err?.message || 'Failed to set hotkey')
      const s = await window.electronAPI.getHotkeySettings()
      setVoiceHotkey(s.voiceToggle)
    }
  }, [])

  return (
    <div className="h-full overflow-auto p-5">
      <div className="text-center mb-5 animate-stagger-in" style={{ animationDelay: '0ms' }}>
        <h2 className="font-display font-semibold text-sm gradient-text">Settings</h2>
      </div>

      {/* AI Provider */}
      <AIProviderSettings />

      {/* ChatGPT Account */}
      <ChatGPTSettings />

      {/* Configurable Hotkeys */}
      <div className="mb-6 animate-stagger-in" style={{ animationDelay: '100ms' }}>
        <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">Global Hotkeys</label>
        <div className="glass-card rounded-xl p-3 hover-lift">
          <HotkeyRow label="Voice Toggle" value={voiceHotkey} onChange={handleHotkeyChange} />
          {hotkeyError && (
            <p className="text-[10px] text-red-400 mt-1">{hotkeyError}</p>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="mb-6 animate-stagger-in" style={{ animationDelay: '120ms' }}>
        <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">Keyboard Shortcuts</label>
        <div className="glass-card rounded-xl p-3 hover-lift">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {SHORTCUTS.map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <kbd className="min-w-[28px] px-1.5 py-0.5 rounded-md bg-surface-3 border border-white/[0.06] text-white/50 font-mono text-[10px] text-center">
                  {s.key}
                </kbd>
                <span className="text-[11px] text-white/60">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
