import { useCoachStore } from '../../store'

export default function CoachStatusBadge() {
  const { status, enabled, togglePanel, tips, focusedSessionId } = useCoachStore()
  if (!enabled) return null

  const activeTipCount = tips.filter(t => !t.dismissed && (!focusedSessionId || t.sessionId === focusedSessionId)).length
  const colors: Record<string, string> = {
    active: 'bg-emerald-400',
    analyzing: 'bg-blue-400 animate-pulse',
    offline: 'bg-zinc-500',
    disabled: 'bg-zinc-700',
  }

  return (
    <button
      onClick={togglePanel}
      className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors text-xs text-zinc-400"
      title={`Coach: ${status}`}
    >
      <span className={`w-2 h-2 rounded-full ${colors[status] || colors.offline}`} />
      <span>Coach</span>
      {activeTipCount > 0 && (
        <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
          {activeTipCount}
        </span>
      )}
    </button>
  )
}
