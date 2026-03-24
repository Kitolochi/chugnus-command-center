import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { useCoachStore } from '../../store'

export default function CoachDaySummary() {
  const { daySummary, tips, sessionCount, clearDay } = useCoachStore()
  const [expanded, setExpanded] = useState(false)

  if (!daySummary) return null

  const activeTips = tips.filter(t => !t.dismissed).length

  return (
    <div className="bg-surface-2 rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="text-xs font-medium text-zinc-300">Day Summary</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span>{sessionCount} sessions</span>
          <span>{activeTips} tips</span>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-zinc-400 leading-relaxed">{daySummary}</p>
          <button
            onClick={clearDay}
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={10} /> Clear
          </button>
        </div>
      )}
    </div>
  )
}
