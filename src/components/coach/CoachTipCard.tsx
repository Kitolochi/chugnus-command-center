import { X, Bookmark, Copy, Info, Lightbulb, AlertTriangle } from 'lucide-react'
import type { CoachTip } from '../../types'
import { useCoachStore } from '../../store'

const CATEGORY_COLORS: Record<string, string> = {
  workflow: 'border-l-blue-500',
  prompt: 'border-l-purple-500',
  strategic: 'border-l-amber-500',
}

const CATEGORY_BADGE: Record<string, string> = {
  workflow: 'bg-blue-500/20 text-blue-400',
  prompt: 'bg-purple-500/20 text-purple-400',
  strategic: 'bg-amber-500/20 text-amber-400',
}

const SEVERITY_ICON: Record<string, typeof Info> = {
  info: Info,
  suggestion: Lightbulb,
  warning: AlertTriangle,
}

export default function CoachTipCard({ tip }: { tip: CoachTip }) {
  const { dismissTip, saveTip } = useCoachStore()
  const Icon = SEVERITY_ICON[tip.severity] || Info

  return (
    <div className={`bg-surface-2 rounded-lg border-l-2 ${CATEGORY_COLORS[tip.category]} p-3 space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-zinc-400 shrink-0" />
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[tip.category]}`}>
            {tip.category}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!tip.saved && (
            <button onClick={() => saveTip(tip.id)} className="p-1 hover:bg-white/5 rounded" title="Save to memories">
              <Bookmark size={12} className="text-zinc-500" />
            </button>
          )}
          <button
            onClick={() => navigator.clipboard.writeText(`${tip.title}\n${tip.body}`)}
            className="p-1 hover:bg-white/5 rounded" title="Copy"
          >
            <Copy size={12} className="text-zinc-500" />
          </button>
          <button onClick={() => dismissTip(tip.id)} className="p-1 hover:bg-white/5 rounded" title="Dismiss">
            <X size={12} className="text-zinc-500" />
          </button>
        </div>
      </div>
      <p className="text-sm font-medium text-zinc-200">{tip.title}</p>
      <p className="text-xs text-zinc-400 leading-relaxed">{tip.body}</p>
      {tip.reference && (
        <p className="text-[11px] text-zinc-500 italic border-l border-zinc-700 pl-2">
          {tip.reference}
        </p>
      )}
      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
        <span>{tip.project}</span>
        <span>{new Date(tip.timestamp).toLocaleTimeString()}</span>
        {tip.saved && <span className="text-emerald-500">Saved</span>}
      </div>
    </div>
  )
}
