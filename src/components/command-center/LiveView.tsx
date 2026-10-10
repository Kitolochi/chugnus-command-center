import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react'
import { Badge, EmptyState } from '../ui'
import type { LiveMessage, LiveSession } from '../../types'

const LIST_POLL_MS = 3000
const MESSAGES_POLL_MS = 2000

function ago(ms: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - ms) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

function statusLabel(status: string): { text: string; color: string; dot: string } {
  if (status === 'busy')
    return { text: 'Working', color: 'text-accent-emerald', dot: 'bg-accent-emerald animate-pulse' }
  if (status === 'idle') return { text: 'Waiting for you', color: 'text-accent-amber', dot: 'bg-accent-amber' }
  return { text: status, color: 'text-white/40', dot: 'bg-white/30' }
}

function LiveMessages({ session }: { session: LiveSession }) {
  const [messages, setMessages] = useState<LiveMessage[] | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const load = () =>
      window.electronAPI
        .liveMessages({ sessionId: session.sessionId, cwd: session.cwd })
        .then((next) => active && setMessages(next))
        .catch(() => active && setMessages([]))
    load()
    const timer = setInterval(load, MESSAGES_POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [session.sessionId, session.cwd])

  const lastText = messages?.[messages.length - 1]?.text
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages?.length, lastText])

  if (!messages) return <p className="px-4 pb-3 text-[10px] text-white/30">Loading...</p>
  if (messages.length === 0) return <p className="px-4 pb-3 text-[10px] text-white/30">No messages yet.</p>

  return (
    <div ref={scrollRef} className="max-h-[420px] overflow-y-auto border-t border-white/[0.04] px-4 py-3 space-y-2">
      {messages.map((message, i) =>
        message.role === 'tool' ? (
          <p key={i} className="text-[10px] font-mono text-white/30 truncate" title={message.text}>
            {message.text}
          </p>
        ) : (
          <div key={i} className={message.role === 'user' ? 'border-l-2 border-accent-blue/40 pl-2' : ''}>
            {message.role === 'user' && <p className="text-[9px] text-accent-blue/70 mb-0.5">You</p>}
            <p className="text-[11px] leading-relaxed text-white/75 whitespace-pre-wrap break-words">{message.text}</p>
          </div>
        )
      )}
    </div>
  )
}

export default function LiveView() {
  const [sessions, setSessions] = useState<LiveSession[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    const load = () =>
      window.electronAPI
        .liveList()
        .then((next) => {
          if (!active) return
          setSessions(next)
          setNow(Date.now())
        })
        .catch(() => active && setSessions([]))
    load()
    const timer = setInterval(load, LIST_POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  if (!sessions) return <p className="text-[11px] text-white/30">Looking for open terminals...</p>
  if (sessions.length === 0)
    return (
      <EmptyState
        icon={<Terminal size={20} className="text-white/30" />}
        title="No open terminal sessions"
        description="Claude Code sessions you start in a terminal show up here while they run."
      />
    )

  const working = sessions.filter((s) => s.status === 'busy').length
  const sorted = [...sessions].sort((a, b) => Number(b.status === 'busy') - Number(a.status === 'busy'))

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono text-white/40 px-1">
        {sessions.length} open · {working} working · read only, reply in the terminal
      </p>
      {sorted.map((session) => {
        const status = statusLabel(session.status)
        const open = openId === session.sessionId
        return (
          <div key={session.sessionId} className="bg-surface-1 border border-white/[0.04] rounded-lg">
            <button
              onClick={() => setOpenId(open ? null : session.sessionId)}
              className="w-full text-left px-4 py-2.5 flex items-start gap-3"
            >
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-white/90 truncate">{session.title}</span>
                  <Badge>{session.projectName}</Badge>
                  <span className="text-[9px] font-mono text-white/25 shrink-0">{session.name}</span>
                </div>
                {session.latestActivity && (
                  <p className="mt-0.5 text-[10px] text-white/45 truncate">{session.latestActivity}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[10px]">
                <span className={status.color}>{status.text}</span>
                <span className="text-white/25 font-mono">{ago(session.updatedAt, now)}</span>
                {open ? (
                  <ChevronDown size={12} className="text-white/30" />
                ) : (
                  <ChevronRight size={12} className="text-white/30" />
                )}
              </div>
            </button>
            {open && <LiveMessages session={session} />}
          </div>
        )
      })}
    </div>
  )
}
