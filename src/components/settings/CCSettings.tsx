import { useState, useEffect } from 'react'

const EFFORT_LEVELS = ['low', 'medium', 'high', 'max'] as const
const MODELS = [
  { id: 'claude-sonnet-4-5-20250929', label: 'Sonnet' },
  { id: 'claude-opus-4-6', label: 'Opus' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku' },
]

export default function CCSettings() {
  const [effort, setEffort] = useState('high')
  const [model, setModel] = useState('claude-sonnet-4-5-20250929')
  const [autoInfer, setAutoInfer] = useState(true)

  useEffect(() => {
    window.electronAPI.ccGetSettings().then((s) => {
      setEffort(s.defaultEffort)
      setModel(s.defaultModel)
      setAutoInfer(s.autoInferModel)
    })
  }, [])

  const save = (updates: Record<string, any>) => {
    window.electronAPI.ccSaveSettings(updates)
  }

  return (
    <div className="mb-6 animate-stagger-in" style={{ animationDelay: '40ms' }}>
      <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">
        Command Center
      </label>
      <div className="glass-card rounded-xl p-3 hover-lift space-y-3">
        {/* Effort level */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/70">Default Effort</span>
          <div className="flex bg-surface-2 rounded-lg p-0.5">
            {EFFORT_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => {
                  setEffort(level)
                  save({ defaultEffort: level })
                }}
                className={`px-2.5 py-1 text-[10px] font-accent tracking-wide rounded-md transition-all ${
                  effort === level ? 'bg-surface-4 text-white/90' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Default model */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/70">Default Model</span>
          <div className="flex bg-surface-2 rounded-lg p-0.5">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setModel(m.id)
                  save({ defaultModel: m.id })
                }}
                className={`px-2.5 py-1 text-[10px] font-accent tracking-wide rounded-md transition-all ${
                  model === m.id ? 'bg-surface-4 text-white/90' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-infer model toggle */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] text-white/70">Auto-infer model</span>
            <p className="text-[9px] text-white/30">Switch to Opus for coding prompts</p>
          </div>
          <button
            onClick={() => {
              const next = !autoInfer
              setAutoInfer(next)
              save({ autoInferModel: next })
            }}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              autoInfer ? 'bg-accent-emerald/40' : 'bg-surface-3'
            }`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                autoInfer ? 'left-4 bg-accent-emerald' : 'left-0.5 bg-white/30'
              }`}
            />
          </button>
        </div>

        {/* Slash commands reference */}
        <div className="px-2.5 py-2 rounded-lg bg-surface-2/60">
          <span className="text-[9px] uppercase tracking-widest text-white/30 font-display">Prompt Commands</span>
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] font-mono">
            <span className="text-accent-cyan">/effort</span>
            <span className="text-white/40">Set thinking level</span>
            <span className="text-accent-cyan">/model</span>
            <span className="text-white/40">Switch model</span>
            <span className="text-accent-cyan">/mcp</span>
            <span className="text-white/40">List MCP servers</span>
            <span className="text-accent-cyan">/agents</span>
            <span className="text-white/40">List agents</span>
            <span className="text-accent-cyan">/doctor</span>
            <span className="text-white/40">Health check</span>
            <span className="text-accent-cyan">/name</span>
            <span className="text-white/40">Name session</span>
            <span className="text-accent-cyan">/cost</span>
            <span className="text-white/40">Session stats</span>
            <span className="text-accent-cyan">!cmd</span>
            <span className="text-white/40">Run shell command</span>
          </div>
        </div>
      </div>
    </div>
  )
}
