import { useEffect, useState } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import CollabThread from './CollabThread'
import { Sparkles, ChevronDown, ChevronRight, Clock, DollarSign, RotateCcw, MessageSquare } from 'lucide-react'
import type { CollabSession } from '../../types'
import { renderMarkdown } from '../../utils/markdown'

function formatCost(usd: number): string {
  if (usd < 0.01) return '<1¢'
  return `$${usd.toFixed(4)}`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatElapsed(startMs: number, endMs?: number): string {
  const ms = (endMs || Date.now()) - startMs
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

const STATUS_BADGE: Record<string, { text: string; className: string }> = {
  completed: { text: 'Completed', className: 'bg-accent-blue/20 text-accent-blue' },
  killed: { text: 'Stopped', className: 'bg-white/10 text-white/50' },
  errored: { text: 'Error', className: 'bg-accent-red/20 text-accent-red' },
  running: { text: 'Running', className: 'bg-accent-emerald/20 text-accent-emerald' },
  awaiting_input: { text: 'Awaiting', className: 'bg-accent-amber/20 text-accent-amber' },
}

function HistoryItem({ session, onResume }: { session: CollabSession; onResume: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const badge = STATUS_BADGE[session.status] || STATUS_BADGE.completed

  return (
    <div className="bg-surface-1 rounded-lg border border-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {expanded
          ? <ChevronDown size={12} className="text-white/30 shrink-0" />
          : <ChevronRight size={12} className="text-white/30 shrink-0" />
        }
        <span className="text-[11px] text-white/70 flex-1 line-clamp-1 font-medium">{session.task}</span>
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium shrink-0 ${badge.className}`}>
          {badge.text}
        </span>
        <div className="flex items-center gap-2.5 text-[9px] text-white/30 shrink-0">
          <span className="flex items-center gap-0.5">
            <MessageSquare size={8} />
            {session.turns.length}
          </span>
          <span className="flex items-center gap-0.5">
            <DollarSign size={8} />
            {formatCost(session.totalCostUsd)}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock size={8} />
            {formatElapsed(session.startedAt, session.completedAt)}
          </span>
          <span>{formatTime(session.startedAt)}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-2">
          {/* Summary + resume */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {session.summary && (
                <div
                  className="text-[11px] text-white/60 leading-relaxed line-clamp-4 [&_pre]:my-1 [&_code]:text-[10px]"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(session.summary) }}
                />
              )}
              {session.errorMessage && (
                <p className="text-[11px] text-accent-red">{session.errorMessage}</p>
              )}
              {session.parentSessionId && (
                <p className="text-[9px] text-white/25 mt-1">Resumed from previous session</p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onResume(session.id) }}
              className="flex items-center gap-1 px-2.5 py-1 bg-surface-3 text-white/50 rounded text-[10px] hover:text-accent-teal hover:bg-accent-teal/10 transition-colors shrink-0"
            >
              <RotateCcw size={10} />
              Resume
            </button>
          </div>

          {/* Turn previews */}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {session.turns.map((turn) => {
              const isClaude = turn.agent === 'claude'
              const label = isClaude ? 'Claude' : 'GPT-5.4'
              const color = isClaude ? 'text-accent-teal' : 'text-accent-amber'
              const border = isClaude ? 'border-accent-teal/20' : 'border-accent-amber/20'
              return (
                <div key={turn.id} className={`border-l ${border} pl-2 py-0.5`}>
                  <span className={`text-[9px] font-medium ${color}`}>{label}</span>
                  <p className="text-[10px] text-white/40 line-clamp-2 mt-0.5">{turn.content.slice(0, 200)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CollabView() {
  const {
    collabSession, collabHistory,
    startCollab, resumeCollab, loadCollabHistory, updateCollabSession,
  } = useCommandCenterStore()

  const [task, setTask] = useState('')
  const [maxRounds, setMaxRounds] = useState(4)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    loadCollabHistory()
    window.electronAPI.collabGetSession().then((s) => {
      if (s) updateCollabSession(s)
    })

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

  const handleResume = async (sessionId: string) => {
    setLaunching(true)
    try {
      await resumeCollab(sessionId, maxRounds)
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
          <h3 className="text-[13px] font-semibold text-white/80 font-accent tracking-tight">Dual-Agent Collaboration</h3>
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
          <h3 className="text-[11px] font-semibold text-white/50 mb-2 font-accent tracking-wide uppercase">Past Sessions</h3>
          <div className="space-y-1.5">
            {collabHistory.map((session) => (
              <HistoryItem key={session.id} session={session} onResume={handleResume} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
