import { useEffect, useRef, useState } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { renderMarkdown } from '../../utils/markdown'
import type { CollabSession, CollabTurn } from '../../types'
import { Square, Send, Clock, Zap, DollarSign } from 'lucide-react'

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(2)}¢`
  return `$${usd.toFixed(4)}`
}

function TurnBubble({ turn }: { turn: CollabTurn }) {
  const isClaude = turn.agent === 'claude'
  const label = isClaude ? 'Claude' : 'GPT-5.4'
  const borderColor = isClaude ? 'border-accent-teal' : 'border-accent-amber'
  const labelColor = isClaude ? 'text-accent-teal' : 'text-accent-amber'

  return (
    <div className={`border-l-2 ${borderColor} pl-3 py-2`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] font-semibold ${labelColor}`}>{label}</span>
        <div className="flex items-center gap-2 text-[9px] text-white/30">
          <span className="flex items-center gap-0.5">
            <Clock size={8} />
            {formatDuration(turn.durationMs)}
          </span>
          <span className="flex items-center gap-0.5">
            <Zap size={8} />
            {turn.tokensIn + turn.tokensOut} tok
          </span>
          <span className="flex items-center gap-0.5">
            <DollarSign size={8} />
            {formatCost(turn.costUsd)}
          </span>
        </div>
      </div>
      <div
        className="text-[12px] text-white/80 leading-relaxed [&_pre]:my-1.5 [&_code]:text-[10px]"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(turn.content) }}
      />
    </div>
  )
}

export default function CollabThread({ session }: { session: CollabSession }) {
  const { respondCollab, killCollab } = useCommandCenterStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [session.turns.length, session.status])

  const handleSend = async () => {
    if (!input.trim()) return
    setSending(true)
    try {
      await respondCollab(input.trim())
      setInput('')
    } finally {
      setSending(false)
    }
  }

  const handleKill = async () => {
    await killCollab()
    setShowKillConfirm(false)
  }

  const elapsed = Date.now() - session.startedAt
  const isActive = session.status === 'running' || session.status === 'awaiting_input'

  const statusBadge = {
    running: { text: 'Running', className: 'bg-accent-emerald/20 text-accent-emerald' },
    awaiting_input: { text: 'Awaiting Input', className: 'bg-accent-amber/20 text-accent-amber' },
    completed: { text: 'Completed', className: 'bg-accent-blue/20 text-accent-blue' },
    killed: { text: 'Killed', className: 'bg-white/10 text-white/50' },
    errored: { text: 'Error', className: 'bg-accent-red/20 text-accent-red' },
  }[session.status]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/5 pb-3 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[12px] text-white/70 line-clamp-1 flex-1 mr-2">{session.task}</p>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium shrink-0 ${statusBadge.className}`}>
            {statusBadge.text}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/40">
          <span>{session.turns.length} turns</span>
          <span>{session.roundCount} rounds</span>
          <span>{formatCost(session.totalCostUsd)} total</span>
          <span>{formatDuration(elapsed)} elapsed</span>
        </div>
      </div>

      {/* Turns */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {session.turns.map((turn) => (
          <TurnBubble key={turn.id} turn={turn} />
        ))}

        {session.status === 'running' && (
          <div className="flex items-center gap-2 pl-3 py-2 text-[11px] text-white/30">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
            Thinking...
          </div>
        )}

        {session.status === 'errored' && session.errorMessage && (
          <div className="border-l-2 border-accent-red pl-3 py-2">
            <p className="text-[11px] text-accent-red">{session.errorMessage}</p>
          </div>
        )}
      </div>

      {/* Input area — only when awaiting input */}
      {session.status === 'awaiting_input' && (
        <div className="flex-shrink-0 mt-3 pt-3 border-t border-white/5">
          {session.inputQuestion && (
            <p className="text-[11px] text-accent-amber mb-2">{session.inputQuestion}</p>
          )}
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Type your response..."
              className="flex-1 bg-surface-2 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-accent-teal/50"
              rows={2}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="self-end px-3 py-2 bg-accent-teal/20 text-accent-teal rounded-lg text-[11px] font-medium hover:bg-accent-teal/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Footer — kill button */}
      {isActive && (
        <div className="flex-shrink-0 mt-3 pt-3 border-t border-white/5 flex justify-end">
          {showKillConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">Stop this session?</span>
              <button
                onClick={handleKill}
                className="px-2.5 py-1 bg-accent-red/20 text-accent-red rounded text-[10px] font-medium hover:bg-accent-red/30 transition-colors"
              >
                Yes, stop
              </button>
              <button
                onClick={() => setShowKillConfirm(false)}
                className="px-2.5 py-1 bg-surface-3 text-white/50 rounded text-[10px] hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowKillConfirm(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-3 text-white/40 rounded text-[10px] hover:text-accent-red hover:bg-accent-red/10 transition-colors"
            >
              <Square size={10} />
              Stop Session
            </button>
          )}
        </div>
      )}
    </div>
  )
}
