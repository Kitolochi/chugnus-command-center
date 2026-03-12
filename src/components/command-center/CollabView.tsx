import { useEffect, useState } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import CollabThread from './CollabThread'
import { Sparkles, ChevronDown, ChevronRight, Clock, DollarSign } from 'lucide-react'
import type { CollabSession } from '../../types'
import { renderMarkdown } from '../../utils/markdown'

function formatCost(usd: number): string {
  if (usd < 0.01) return `<1¢`
  return `$${usd.toFixed(4)}`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function HistoryItem({ session }: { session: CollabSession }) {
  const [expanded, setExpanded] = useState(false)

  const statusBadge = {
    completed: { text: 'Completed', className: 'bg-accent-blue/20 text-accent-blue' },
    killed: { text: 'Killed', className: 'bg-white/10 text-white/50' },
    errored: { text: 'Error', className: 'bg-accent-red/20 text-accent-red' },
    running: { text: 'Running', className: 'bg-accent-emerald/20 text-accent-emerald' },
    awaiting_input: { text: 'Awaiting', className: 'bg-accent-amber/20 text-accent-amber' },
  }[session.status]

  return (
    <div className="bg-surface-1 rounded-lg border border-white/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors rounded-lg"
      >
        {expanded ? <ChevronDown size={12} className="text-white/30 shrink-0" /> : <ChevronRight size={12} className="text-white/30 shrink-0" />}
        <span className="text-[11px] text-white/70 flex-1 line-clamp-1">{session.task}</span>
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium shrink-0 ${statusBadge.className}`}>
          {statusBadge.text}
        </span>
        <span className="text-[9px] text-white/30 shrink-0 flex items-center gap-0.5">
          <DollarSign size={8} />
          {formatCost(session.totalCostUsd)}
        </span>
        <span className="text-[9px] text-white/30 shrink-0 flex items-center gap-0.5">
          <Clock size={8} />
          {formatTime(session.startedAt)}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-white/5 mt-0 pt-2 space-y-2 max-h-80 overflow-y-auto">
          <div className="text-[10px] text-white/40">
            {session.turns.length} turns &middot; {session.roundCount} rounds
          </div>
          {session.summary && (
            <div
              className="text-[11px] text-white/60 leading-relaxed [&_pre]:my-1 [&_code]:text-[10px]"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(session.summary) }}
            />
          )}
          {session.turns.map((turn) => {
            const isClaude = turn.agent === 'claude'
            const label = isClaude ? 'Claude' : 'GPT-5.4'
            const color = isClaude ? 'text-accent-teal' : 'text-accent-amber'
            return (
              <div key={turn.id} className="border-l border-white/5 pl-2">
                <span className={`text-[9px] font-medium ${color}`}>{label}</span>
                <p className="text-[10px] text-white/50 line-clamp-3 mt-0.5">{turn.content.slice(0, 300)}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CollabView() {
  const {
    collabSession, collabHistory,
    startCollab, loadCollabHistory, updateCollabSession,
  } = useCommandCenterStore()

  const [task, setTask] = useState('')
  const [maxRounds, setMaxRounds] = useState(4)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    // Load initial state
    loadCollabHistory()
    window.electronAPI.collabGetSession().then((s) => {
      if (s) updateCollabSession(s)
    })

    // Subscribe to live updates
    const unsub = window.electronAPI.onCollabUpdate((session) => {
      useCommandCenterStore.getState().updateCollabSession(session)
    })
    return unsub
  }, [])

  const handleLaunch = async () => {
    if (!task.trim()) return
    setLaunching(true)
    try {
      await startCollab(task.trim(), maxRounds)
      setTask('')
    } finally {
      setLaunching(false)
    }
  }

  // Active session view
  if (collabSession) {
    return <CollabThread session={collabSession} />
  }

  return (
    <div className="space-y-6">
      {/* Launch form */}
      <div className="bg-surface-1 rounded-xl border border-white/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-accent-teal" />
          <h3 className="text-[12px] font-semibold text-white/80">Dual-Agent Collaboration</h3>
        </div>
        <p className="text-[10px] text-white/40 mb-3">
          Claude Opus 4.6 and GPT 5.4 collaborate on your task. They only ask for input when they need human judgment.
        </p>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleLaunch()
            }
          }}
          placeholder="Describe the coding task..."
          className="w-full bg-surface-2 border border-white/10 rounded-lg px-3 py-2.5 text-[12px] text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-accent-teal/50"
          rows={3}
          disabled={launching}
        />
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-white/40">Check-in after</label>
            <select
              value={maxRounds}
              onChange={(e) => setMaxRounds(Number(e.target.value))}
              className="bg-surface-3 border border-white/10 rounded px-2 py-0.5 text-[10px] text-white/70 focus:outline-none"
              disabled={launching}
            >
              <option value={2}>2 rounds</option>
              <option value={4}>4 rounds</option>
              <option value={6}>6 rounds</option>
              <option value={8}>8 rounds</option>
              <option value={12}>12 rounds</option>
            </select>
          </div>
          <button
            onClick={handleLaunch}
            disabled={!task.trim() || launching}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-teal/20 text-accent-teal rounded-lg text-[11px] font-medium hover:bg-accent-teal/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles size={12} />
            {launching ? 'Starting...' : 'Start Collab'}
          </button>
        </div>
      </div>

      {/* Past sessions */}
      {collabHistory.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-white/50 mb-2">Past Sessions</h3>
          <div className="space-y-1.5">
            {collabHistory.map((session) => (
              <HistoryItem key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
