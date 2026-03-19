import { useState, useRef, useEffect } from 'react'
import { useCommandCenterStore, CCQueueItem } from '../../store/commandCenterStore'
import { Badge } from '../ui'
import { Loader2, Send, MessageSquare, AlertTriangle, Square } from 'lucide-react'

export default function CollapsedCard({ item, onFocus }: { item: CCQueueItem; onFocus?: () => void }) {
  const { respond, park } = useCommandCenterStore()
  const [showInput, setShowInput] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-render every 30s for elapsed timers
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  const handleSend = () => {
    if (!text.trim()) return
    respond(item.processId, text.trim())
    setText('')
    setShowInput(false)
  }

  const idleMinutes = Math.floor((Date.now() - item.lastActivityAt) / 60000)
  const isStale = item.status === 'working' && idleMinutes >= 5

  const statusText = {
    working: isStale ? `Quiet ${idleMinutes}m` : 'Working...',
    awaiting_input: 'Awaiting input',
    errored: 'Error',
  }[item.status]

  const opacity = item.status === 'working' && !showInput && !isStale ? 'opacity-50' : ''

  return (
    <div className={`bg-surface-1 border border-white/[0.04] rounded-lg ${opacity} hover:opacity-100 transition-opacity`}>
      <div className="px-4 py-2.5 cursor-pointer" onClick={onFocus}>
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge>{item.projectName}</Badge>
          <span className="text-[10px] text-white/40 truncate max-w-[200px]">
            {item.prompt.slice(0, 60)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {item.status !== 'errored' && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowInput(!showInput) }}
              className="p-1 rounded text-white/20 hover:text-accent-blue hover:bg-white/[0.04] transition-colors"
              title="Send input"
            >
              <MessageSquare size={10} />
            </button>
          )}
          {item.pendingInput && <span className="text-[9px] text-accent-blue">queued</span>}
          {item.status === 'working' && !isStale && <Loader2 size={10} className="text-accent-emerald animate-spin" />}
          {isStale && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); park(item.processId) }}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber text-[9px] hover:bg-accent-amber/25 transition-all"
                title="Stop this task"
              >
                <Square size={7} /> Stop
              </button>
              <AlertTriangle size={10} className="text-accent-amber" />
            </>
          )}
          <span className={`text-[9px] ${
            item.status === 'awaiting_input' ? 'text-accent-amber' :
            item.status === 'errored' ? 'text-accent-red' :
            isStale ? 'text-accent-amber' : 'text-accent-emerald'
          }`}>{statusText}</span>
        </div>
        </div>
        {item.resultText && (
          <p className="text-[10px] text-white/50 mt-1.5 line-clamp-1 leading-relaxed">
            {item.resultText.split(/[.!?\n]/)[0].slice(0, 150)}
          </p>
        )}
      </div>
      {showInput && (
        <div className="px-4 pb-2.5 flex gap-2 items-center">
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); if (e.key === 'Escape') setShowInput(false) }}
            placeholder="Send input..."
            className="flex-1 bg-surface-0 border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white/90 placeholder-white/20 focus:outline-none focus:border-accent-blue/40"
          />
          <button onClick={handleSend} disabled={!text.trim()} className="p-1.5 rounded-lg bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 transition-all disabled:opacity-30">
            <Send size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
