import { useEffect, useState } from 'react'
import { Check, Circle, Loader2, Pause, AlertTriangle, Terminal } from 'lucide-react'
import type { CodexSession, CodexMessage } from '../../types/codex'
import { renderMarkdown } from '../../utils/markdown'
import { useSessionCollapse } from '../../hooks/useSessionCollapse'
import { excerpt } from '../../lib/conversationContext'

const labels = { starting: 'Starting', working: 'Working on this', completed: 'Turn finished', interrupted: 'Interrupted', failed: 'Failed' }
const activityLabels: Record<string, string> = { command_execution: 'Command', file_change: 'File changes', web_search: 'Web search', mcp_tool_call: 'Tool', reasoning: 'Progress', todo_list: 'Plan', error: 'Connection update' }

function messageState(session: CodexSession, message: CodexMessage) {
  if (message.state) return message.state
  const users = session.messages.filter(m => m.role === 'user')
  if (users[users.length - 1]?.id === message.id) {
    if (session.status === 'working') return 'working'
    if (session.status === 'stopped') return 'interrupted'
    if (session.status === 'error') return 'failed'
  }
  return undefined
}

export default function CodexConversation({ session }: { session: CodexSession }) {
  const [activityCollapsed, toggleActivity] = useSessionCollapse(session.id, 'activity')
  const [messagesCollapsed, toggleMessages] = useSessionCollapse(session.id, 'messages')
  const [showAll, setShowAll] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer) }, [])
  const requests = session.messages.filter(m => m.role === 'user')
  const current = requests[requests.length - 1]
  const latestUpdate = current ? session.messages.slice(session.messages.indexOf(current) + 1).filter(m => m.role === 'assistant').pop()?.content : undefined
  const working = session.status === 'working'
  const currentState = current ? messageState(session, current) : undefined
  const activity = [...session.activity].reverse().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4)
  const eventAge = session.lastEventAt ? Math.max(0, Math.floor((now - session.lastEventAt) / 1000)) : null
  const age = eventAge === null ? '' : eventAge < 60 ? `${eventAge}s` : `${Math.floor(eventAge / 60)}m`
  const visible = showAll ? requests : requests.slice(-4)

  return <div className="mb-3 space-y-3" aria-label="Codex conversation progress">
    <section className="rounded-lg border border-accent-blue/20 bg-accent-blue/5 p-3" aria-label="Current work">
      <div className="flex items-center justify-between gap-2 text-[11px] mb-2">
        <span className="flex items-center gap-1.5 text-accent-blue font-medium">
          {working ? <Loader2 size={12} className="animate-spin" /> : session.status === 'ready' ? <Check size={12} /> : session.status === 'error' ? <AlertTriangle size={12} /> : <Pause size={12} />}
          {working ? currentState === 'completed' ? 'Turn finished — closing out' : currentState === 'starting' ? 'Starting your message' : `Working on message ${requests.length}` : session.status === 'stopped' ? 'Paused — no work running' : session.status === 'error' ? 'Stopped after an error' : 'Ready for your next message'}
        </span>
        <span className="text-white/40">{session.pendingTurns?.length || 0} waiting{session.queuePaused && session.pendingTurns?.length ? ' · queue paused' : ''}</span>
      </div>
      <button onClick={toggleActivity} aria-expanded={!activityCollapsed} className="text-[10px] text-accent-blue mb-2">{activityCollapsed ? 'Show activity' : 'Hide activity'}</button>
      {!activityCollapsed && <>
      {current && <p className="text-xs text-white/85 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">{current.content}</p>}
      {working && <p className="mt-2 text-[10px] text-white/40">{eventAge === null ? 'Waiting for the first activity update…' : `Last activity ${age} ago${eventAge >= 60 ? ' — no new output received since then' : ''}`}</p>}
      {working && latestUpdate && <p className="mt-2 text-[11px] text-white/65 leading-relaxed"><span className="text-white/35">Codex update: </span>{excerpt(latestUpdate, 400)}</p>}
      {!!activity.length && <div className="mt-3 border-t border-white/[0.06] pt-2 space-y-1.5" aria-label="Recent Codex activity">
        <p className="text-[9px] uppercase tracking-wide text-white/35">{working ? 'Recent activity' : 'Last recorded activity'}</p>
        {activity.map(a => <details key={a.id} className="text-[10px] text-white/60">
          <summary className="cursor-pointer break-words leading-relaxed">
            <Terminal size={10} className="inline mr-1 text-accent-blue" />
            <span className="text-white/80">{activityLabels[a.kind] || a.kind}</span>{' '}
            <span className="text-white/35">{a.status === 'in_progress' ? working ? 'running' : 'interrupted' : a.status || ''}</span>{' — '}{excerpt(a.text.split('\n')[0], 180)}
          </summary>
          <pre className="mt-1 rounded bg-surface-0 p-2 max-h-48 overflow-auto whitespace-pre-wrap break-words select-text text-[10px]">{a.text}</pre>
        </details>)}
      </div>}
      </>}
    </section>
    <section aria-label="Message progress" className="space-y-2">
      <div className="flex justify-between items-center text-[10px] text-white/40">
        <button onClick={toggleMessages} aria-expanded={!messagesCollapsed} className="text-accent-blue">{messagesCollapsed ? 'Show messages' : 'Hide messages'}</button>
        <span>Your messages · {requests.length} sent</span>
        {requests.length > 4 && <button type="button" className="text-accent-blue" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show recent' : `Show all ${requests.length}`}</button>}
      </div>
      {!messagesCollapsed && <>
      <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
        {visible.map(request => {
          const index = session.messages.indexOf(request)
          const next = session.messages.findIndex((m, i) => i > index && m.role === 'user')
          const replies = session.messages.slice(index + 1, next < 0 ? undefined : next).filter(m => m.role === 'assistant')
          const state = messageState(session, request)
          const Icon = state === 'completed' ? Check : state === 'working' || state === 'starting' ? Loader2 : state === 'interrupted' ? Pause : state === 'failed' ? AlertTriangle : Circle
          const color = state === 'completed' ? 'text-accent-emerald' : state === 'failed' ? 'text-accent-red' : state === 'interrupted' ? 'text-accent-amber' : 'text-accent-blue'
          return <div key={request.id} className="rounded-lg border border-white/[0.06] bg-surface-0 p-2.5" data-message-id={request.id}>
            <div className="flex justify-between gap-2 text-[10px] mb-1">
              <span className="text-white/40">You · {requests.indexOf(request) + 1}{request.queuedId ? ' · from queue' : ''}</span>
              <span className={`flex items-center gap-1 ${state ? color : 'text-white/35'}`}><Icon size={10} className={state === 'working' || state === 'starting' ? 'animate-spin' : ''} />{state ? labels[state] : 'Sent · status not recorded'}</span>
            </div>
            <p className="text-[11px] text-white/80 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{request.content}</p>
            {!!replies.length && <details className="mt-2 text-[11px]" open={request === current ? true : undefined}>
              <summary className="cursor-pointer text-white/40">Codex replies ({replies.length})</summary>
              <div className="mt-2 space-y-2 text-white/70 select-text" onClick={e => { const link = (e.target as HTMLElement).closest('a[data-external-link]') as HTMLAnchorElement | null; if (link) { e.preventDefault(); void window.electronAPI.openExternal(link.href) } }}>
                {replies.map(reply => <div key={reply.id} dangerouslySetInnerHTML={{ __html: renderMarkdown(reply.content) }} />)}
              </div>
            </details>}
          </div>
        })}
      </div>
      <p className="text-[9px] text-white/30">“Turn finished” means Codex finished responding to that message. Queued messages below have not been sent yet.</p>
      </>}
    </section>
  </div>
}
