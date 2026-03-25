import { useCoachStore } from '../../store'
import CoachTipCard from './CoachTipCard'
import CoachDaySummary from './CoachDaySummary'

export default function CoachPanel() {
  const { panelOpen, tips } = useCoachStore()
  const visibleTips = tips.filter(t => !t.dismissed)

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
