import { useCoachStore } from '../../store/coachStore'

const statusColors: Record<string, { dot: string; label: string; text: string }> = {
  active:    { dot: 'bg-green-400',  label: 'Active',    text: 'text-green-400' },
  analyzing: { dot: 'bg-accent-blue', label: 'Analyzing', text: 'text-accent-blue' },
  offline:   { dot: 'bg-accent-red',  label: 'Offline',   text: 'text-accent-red' },
  disabled:  { dot: 'bg-white/20',    label: 'Disabled',  text: 'text-white/30' },
}

export default function CoachSettings() {
  const { enabled, status, sessionCount, tips, toggleEnabled, clearDay } = useCoachStore()

  const s = statusColors[status] || statusColors.disabled

  return (
    <div className="mb-6 animate-stagger-in" style={{ animationDelay: '80ms' }}>
      <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">
        Usage Coach
      </label>
      <div className="glass-card rounded-xl p-3 hover-lift space-y-3">
        {/* Enable / disable toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/70">Coach</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'analyzing' ? 'animate-pulse' : ''}`} />
              <span className={`text-[9px] font-mono ${s.text}`}>{s.label}</span>
            </div>
          </div>
          <button
            onClick={toggleEnabled}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              enabled ? 'bg-accent-emerald/40' : 'bg-surface-3'
            }`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                enabled ? 'left-4 bg-accent-emerald' : 'left-0.5 bg-white/30'
              }`}
            />
          </button>
        </div>

        {/* Proxy status row */}
        <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-surface-2/60">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40">Proxy</span>
            <span className="text-[10px] font-mono text-white/50">localhost:8741</span>
          </div>
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
            status === 'offline' || status === 'disabled'
              ? 'bg-red-500/15 text-red-400'
              : 'bg-green-500/15 text-green-400'
          }`}>
            {status === 'offline' ? 'Unreachable' : status === 'disabled' ? 'Off' : 'Connected'}
          </span>
        </div>

        {/* Stats row */}
        {enabled && (
          <div className="flex items-center gap-4 text-[10px] text-white/40 font-mono">
            <span>{sessionCount} session{sessionCount !== 1 ? 's' : ''} watched</span>
            <span>{tips.filter(t => !t.dismissed).length} active tip{tips.filter(t => !t.dismissed).length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Clear day button */}
        <button
          onClick={clearDay}
          disabled={!enabled}
          className="w-full py-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 disabled:opacity-30 text-[10px] text-white/50 hover:text-white/70 transition-all font-medium"
        >
          Clear Day Summary
        </button>
      </div>
    </div>
  )
}
