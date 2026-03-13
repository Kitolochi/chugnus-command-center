import { useState, useRef, useEffect } from 'react'
import { useCommandCenterStore, CCQueueItem } from '../../store/commandCenterStore'
import { Badge } from '../ui'
import { Loader2, Send, MessageSquare } from 'lucide-react'

export default function CollapsedCard({ item, onFocus }: { item: CCQueueItem; onFocus?: () => void }) {
  const { respond } = useCommandCenterStore()
  const [showInput, setShowInput] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  const handleSend = () => {
    if (!text.trim()) return
    respond(item.processId, text.trim())
    setText('')
    setShowInput(false)
  }

  const statusText = {
    working: 'Working...',
    awaiting_input: 'Awaiting input',
    errored: 'Error',
  }[item.status]

  const opacity = item.status === 'working' && !showInput ? 'opacity-50' : ''

  return (
    <div className={`bg-surface-1 border border-white/[0.04] rounded-lg ${opacity} hover:opacity-100 transition-opacity`}>
      <div className="px-4 py-2.5 flex items-center justify-between cursor-pointer" onClick={onFocus}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge>{item.projectName}</Badge>
          <span className="text-[10px] text-white/40 truncate max-w-[200px]">
            {item.resultText?.slice(0, 60) || item.prompt.slice(0, 60)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {item.status !== 'errored' && (
            <button
              onClick={() => setShowInput(!showInput)}
              className="p-1 rounded text-white/20 hover:text-accent-blue hover:bg-white/[0.04] transition-colors"
              title="Send input"
            >
              <MessageSquare size={10} />
            </button>
          )}
          {item.pendingInput && <span className="text-[9px] text-accent-blue">queued</span>}
          {item.status === 'working' && <Loader2 size={10} className="text-accent-emerald animate-spin" />}
          <span className={`text-[9px] ${
            item.status === 'awaiting_input' ? 'text-accent-amber' :
            item.status === 'errored' ? 'text-accent-red' :
            'text-accent-emerald'
          }`}>{statusText}</span>
        </div>
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
