import { useCommandCenterStore, type CCQueueItem } from '../../store/commandCenterStore'
import { describeActivityLine, firstSentence } from '../../lib/describeActivity'
import { statusLabel } from '../../lib/liveStatus'

const TASK_STATUS: Record<CCQueueItem['status'], { dot: string; idle: string }> = {
  working: { dot: 'bg-accent-emerald animate-pulse', idle: 'Starting' },
  awaiting_input: { dot: 'bg-accent-amber', idle: 'Waiting for you' },
  errored: { dot: 'bg-accent-red', idle: 'Stopped with an error' },
}

function taskDoing(item: CCQueueItem): string {
  if (item.status === 'errored') return item.errorMessage ? firstSentence(item.errorMessage) : TASK_STATUS.errored.idle
  if (item.status === 'awaiting_input')
    return item.resultText ? firstSentence(item.resultText) : TASK_STATUS.awaiting_input.idle
  return item.latestActivity ? describeActivityLine(item.latestActivity) : TASK_STATUS.working.idle
}

function Row(props: { dot: string; title: string; doing?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      title={props.doing ? `${props.title}\n${props.doing}` : props.title}
      className={`w-full text-left rounded-lg px-2.5 py-2 flex items-start gap-2 transition-colors ${
        props.selected ? 'bg-surface-3' : 'hover:bg-white/[0.04]'
      }`}
    >
      <span className={`mt-[5px] w-1.5 h-1.5 rounded-full shrink-0 ${props.dot}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium text-white/85 truncate">{props.title}</span>
        {props.doing && <span className="block text-[10px] leading-snug text-white/45 truncate">{props.doing}</span>}
      </span>
    </button>
  )
}

/** Left column: every agent that is running, with a few words on what it is doing. */
export default function AgentsSidebar({ tasks }: { tasks: CCQueueItem[] }) {
  const { liveSessions, liveOpenId, activeView, focusId, setActiveView, setLiveOpenId, setFocusId, selectProject } =
    useCommandCenterStore()
  const terminals = [...(liveSessions || [])].sort(
    (a, b) => Number(b.status === 'busy') - Number(a.status === 'busy') || b.updatedAt - a.updatedAt
  )
  const working =
    terminals.filter((s) => s.status === 'busy').length + tasks.filter((t) => t.status === 'working').length

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-surface-1/40 overflow-y-auto px-2 pt-6 pb-4">
      <div className="flex items-baseline justify-between px-2.5 mb-2">
        <h2 className="text-[11px] font-semibold text-white/80 font-accent tracking-tight">Agents</h2>
        <span className="text-[9px] font-mono text-white/35">
          {terminals.length + tasks.length} running · {working} working
        </span>
      </div>

      {terminals.length > 0 && (
        <>
          <p className="px-2.5 mt-2 mb-1 text-[9px] uppercase tracking-widest text-white/25">Terminals</p>
          {terminals.map((s) => (
            <Row
              key={s.sessionId}
              dot={statusLabel(s.status).dot}
              title={s.title}
              doing={s.status === 'idle' ? (s.doing ? `Waiting · ${s.doing}` : 'Waiting for you') : s.doing}
              selected={activeView === 'live' && liveOpenId === s.sessionId}
              onClick={() => {
                setActiveView('live')
                setLiveOpenId(s.sessionId)
              }}
            />
          ))}
        </>
      )}

      {tasks.length > 0 && (
        <>
          <p className="px-2.5 mt-3 mb-1 text-[9px] uppercase tracking-widest text-white/25">App tasks</p>
          {tasks.map((t) => (
            <Row
              key={t.processId}
              dot={TASK_STATUS[t.status]?.dot || 'bg-white/30'}
              title={t.prompt.split('\n')[0] || t.projectName}
              doing={taskDoing(t)}
              selected={activeView !== 'live' && focusId === t.processId}
              onClick={() => {
                setActiveView(t.provider === 'codex' ? 'codex' : 'queue')
                selectProject(t.projectPath)
                setFocusId(t.processId)
              }}
            />
          ))}
        </>
      )}

      {liveSessions !== null && terminals.length + tasks.length === 0 && (
        <p className="px-2.5 mt-2 text-[10px] text-white/30">No agents running.</p>
      )}
    </aside>
  )
}
