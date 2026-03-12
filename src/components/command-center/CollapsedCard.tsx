import { CCQueueItem } from '../../store/commandCenterStore'
import { Badge } from '../ui'
import { Loader2 } from 'lucide-react'

// Note: clicking a collapsed card scrolls to top where the FocusCard is.
// The queue is already sorted by priority, so the top card is always most urgent.
// To "promote" a card, the user can click it and the view scrolls up.
export default function CollapsedCard({ item }: { item: CCQueueItem }) {
  const statusText = {
    working: 'Working...',
    awaiting_input: 'Awaiting input',
    errored: 'Error',
  }[item.status]

  const opacity = item.status === 'working' ? 'opacity-50' : ''

  return (
    <div className={`bg-surface-1 border border-white/[0.04] rounded-lg px-4 py-2.5 flex items-center justify-between ${opacity} hover:opacity-100 transition-opacity cursor-pointer`}>
      <div className="flex items-center gap-2">
        <Badge>{item.projectName}</Badge>
        <span className="text-[10px] text-white/40 truncate max-w-[200px]">
          {item.resultText?.slice(0, 60) || item.prompt.slice(0, 60)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {item.status === 'working' && <Loader2 size={10} className="text-accent-emerald animate-spin" />}
        <span className={`text-[9px] ${
          item.status === 'awaiting_input' ? 'text-accent-amber' :
          item.status === 'errored' ? 'text-accent-red' :
          'text-accent-emerald'
        }`}>{statusText}</span>
      </div>
    </div>
  )
}
