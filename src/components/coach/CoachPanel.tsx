import { useEffect } from 'react'
import { useCoachStore } from '../../store'
import CoachTipCard from './CoachTipCard'
import CoachDaySummary from './CoachDaySummary'

const MAX_VISIBLE = 5

export default function CoachPanel() {
  const { panelOpen, tips, focusedSessionId, dismissTip } = useCoachStore()

  // Strategic tips always show; workflow/prompt filter to focused session
  const activeTips = tips.filter(t => !t.dismissed && (
    t.category === 'strategic' || !focusedSessionId || t.sessionId === focusedSessionId
  ))

  // Newest first, cap at MAX_VISIBLE
  const sorted = [...activeTips].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const visibleTips = sorted.slice(0, MAX_VISIBLE)

  // Auto-dismiss overflow so tips don't pile up
  useEffect(() => {
    const overflow = sorted.slice(MAX_VISIBLE)
    for (const tip of overflow) dismissTip(tip.id)
  }, [tips.length])

  if (!panelOpen) return null

  return (
    <div className="w-80 shrink-0 border-l border-surface-3 bg-surface-1 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-surface-3">
        <h3 className="text-sm font-medium text-zinc-300">Usage Coach</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <CoachDaySummary />
        {visibleTips.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-8">
            Tips will appear here as you work
          </p>
        ) : (
          visibleTips.map(tip => <CoachTipCard key={tip.id} tip={tip} />)
        )}
      </div>
    </div>
  )
}
