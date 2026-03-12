import { useState, useRef, useEffect, useCallback } from 'react'
import { useCommandCenterStore, CCQueueItem } from '../../store/commandCenterStore'
import { Button, Badge } from '../ui'
import { ChevronRight, Send, Check, Loader2, FileEdit, Terminal } from 'lucide-react'
import ConfettiOverlay from './ConfettiOverlay'
import { renderMarkdown } from '../../utils/markdown'

export default function FocusCard({ item }: { item: CCQueueItem }) {
  const { respond, dismiss, kill } = useCommandCenterStore()
  const [response, setResponse] = useState('')
  const [showFiles, setShowFiles] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (item.status === 'awaiting_input') inputRef.current?.focus()
  }, [item.status])

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a[data-external-link]') as HTMLAnchorElement | null
    if (link) {
      e.preventDefault()
      window.electronAPI.openExternal(link.href)
    }
  }, [])

  const handleSend = () => {
    if (!response.trim()) return
    respond(item.processId, response.trim())
    setResponse('')
  }

  const handleDone = () => {
    setShowConfetti(true)
    setTimeout(() => {
      dismiss(item.processId)
    }, 2000)
  }

  const handleKill = () => {
    if (!confirmKill) { setConfirmKill(true); return }
    kill(item.processId)
    setConfirmKill(false)
  }

  const statusColor = {
    working: 'text-accent-emerald',
    awaiting_input: 'text-accent-amber',
    errored: 'text-accent-red',
  }[item.status]

  const statusLabel = {
    working: 'Working...',
    awaiting_input: 'Awaiting input',
    errored: 'Error',
  }[item.status]

  const displayText = item.status === 'errored'
    ? item.errorMessage || 'Unknown error'
    : (item.resultText || item.prompt)

  // Truncate display
  const truncated = displayText && displayText.length > 500
  const shownText = truncated ? displayText.slice(0, 500) : displayText
  const [showFullText, setShowFullText] = useState(false)

  return (
    <div className="relative">
      {showConfetti && <ConfettiOverlay color={item.projectColor} onDone={() => setShowConfetti(false)} />}
      <div className={`bg-surface-1 border rounded-xl p-4 ${
        item.status === 'awaiting_input' ? 'border-accent-amber/30' :
        item.status === 'errored' ? 'border-accent-red/30' :
        'border-white/[0.06]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant={
              (['blue', 'purple', 'red', 'amber'] as const).includes(item.projectColor as any)
                ? (item.projectColor as 'blue' | 'purple' | 'red' | 'amber')
                : item.projectColor === 'green' ? 'emerald' : 'default'
            }>
              {item.projectName}
            </Badge>
            <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
            {item.status === 'working' && <Loader2 size={10} className="text-accent-emerald animate-spin" />}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/30">${item.costUsd.toFixed(2)}</span>
            <span className="text-[9px] text-white/20">{Math.round((Date.now() - item.startedAt) / 60000)}m ago</span>
          </div>
        </div>

        {/* Result text */}
        <div
          className="text-[12px] text-white/80 mb-3 leading-relaxed select-text cursor-text"
          onClick={handleLinkClick}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(showFullText ? displayText : shownText) }}
        />
        {truncated && !showFullText && (
          <button onClick={() => setShowFullText(true)} className="text-accent-blue text-[10px] mb-3">Show more</button>
        )}

        {/* Expand toggles */}
        <div className="flex items-center gap-3 mb-3 text-[10px]">
          {item.filesChanged.length > 0 && (
            <button onClick={() => setShowFiles(!showFiles)} className="text-white/40 hover:text-white/60 flex items-center gap-1">
              <ChevronRight size={10} className={`transition-transform ${showFiles ? 'rotate-90' : ''}`} />
              Files changed ({item.filesChanged.length})
            </button>
          )}
          {item.fullLog.length > 0 && (
            <button onClick={() => setShowLog(!showLog)} className="text-white/40 hover:text-white/60 flex items-center gap-1">
              <ChevronRight size={10} className={`transition-transform ${showLog ? 'rotate-90' : ''}`} />
              Full log ({item.fullLog.length})
            </button>
          )}
        </div>

        {/* Expanded: Files */}
        {showFiles && (
          <div className="bg-surface-0 rounded-lg p-3 mb-3 space-y-1">
            {item.filesChanged.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-white/50">
                <FileEdit size={10} /> {f}
              </div>
            ))}
          </div>
        )}

        {/* Expanded: Log */}
        {showLog && (
          <div className="bg-surface-0 rounded-lg p-3 mb-3 max-h-64 overflow-y-auto space-y-2">
            {item.fullLog.map((msg, i) => (
              <div key={i} className={`text-[10px] ${
                msg.type === 'assistant' ? 'text-white/70' :
                msg.type === 'tool_use' ? 'text-accent-cyan/70 font-mono' :
                'text-white/40'
              }`}>
                {msg.type === 'tool_use' ? (
                  <span><Terminal size={9} className="inline mr-1" />{msg.toolName}: {msg.toolInput?.slice(0, 100)}</span>
                ) : (
                  msg.text?.slice(0, 300)
                )}
              </div>
            ))}
          </div>
        )}

        {/* Response input */}
        {item.status === 'awaiting_input' && (
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={response}
              onChange={e => setResponse(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Type follow-up..."
              className="flex-1 bg-surface-0 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 placeholder-white/20 focus:outline-none focus:border-accent-blue/40 resize-none min-h-[36px] max-h-[120px]"
              rows={1}
            />
            <Button variant="primary" size="sm" onClick={handleSend} disabled={!response.trim()}>
              <Send size={12} />
            </Button>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
          <button onClick={handleKill} className="text-[10px] text-white/20 hover:text-accent-red transition-colors">
            {confirmKill ? 'Confirm kill?' : 'Kill'}
          </button>
          {item.status === 'awaiting_input' && (
            <Button variant="ghost" size="xs" onClick={handleDone}>
              <Check size={10} /> Done
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
