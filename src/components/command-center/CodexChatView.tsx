import { useEffect, useRef } from 'react'
import { Archive, Loader2, Plus, RefreshCw, RotateCcw, Terminal } from 'lucide-react'
import { useCodexStore } from '../../store/codexStore'
import { renderMarkdown } from '../../utils/markdown'
import CodexComposer from './CodexComposer'
import CodexHistory from './CodexHistory'
import CodexMemory from './CodexMemory'

export default function CodexChatView() {
  const { sessions, selectedId, history, status, error, update, load, select, newTask, archive } = useCodexStore()
  const session = sessions.find(s => s.id === selectedId)
  const visible = sessions.filter(s => history ? s.archived : !s.archived)
  const scrollRef = useRef<HTMLDivElement>(null)
  const working = sessions.filter(s => s.status === 'working').length

  useEffect(() => {
    const unsubscribe = window.electronAPI.onCodexSessionUpdate(update)
    void load()
    return unsubscribe
  }, [load, update])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [selectedId, session?.messages.length])

  return (
    <div className="flex flex-col gap-3 min-h-[520px]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2"><Terminal size={16} className="text-accent-amber" /> Codex {working > 0 && <span className="text-[10px] text-accent-emerald">{working} working</span>}</h3>
          <p className="text-[10px] text-white/40 mt-1">{status ? status.available ? `${status.version} · ${status.auth}` : 'Codex needs attention' : 'Checking Codex…'}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <button onClick={() => useCodexStore.setState({ history: !history })} className="text-white/60 hover:text-white">{history ? 'Active tasks' : 'History'}</button>
          <button aria-label="Refresh Codex connection" title="Refresh Codex connection" onClick={() => void load()} className="p-1.5 text-white/40"><RefreshCw size={13} /></button>
          <button onClick={newTask} className="flex gap-1 items-center px-2 py-1.5 rounded-lg bg-accent-amber/15 text-accent-amber"><Plus size={12} /> New task</button>
        </div>
      </div>
      {(error || status?.error) && <div role="alert" className="p-3 rounded-lg border border-accent-red/20 bg-accent-red/5 text-xs text-accent-red whitespace-pre-wrap">{error || status?.error}</div>}
      {history && <CodexHistory />}

      {visible.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Codex sessions">{visible.map(item => (
        <button key={item.id} onClick={() => select(item.id)} title={`${item.projectPath}\n${item.title}`} className={`shrink-0 w-44 text-left rounded-lg border p-2 ${selectedId === item.id ? 'border-accent-amber/40 bg-accent-amber/5' : 'border-white/10 bg-surface-2'}`}>
          <div className="flex items-center justify-between text-[9px] text-white/40"><span className="truncate">{item.projectPath.split(/[/\\]/).pop()}</span><span className={item.status === 'working' ? 'text-accent-emerald' : item.status === 'error' ? 'text-accent-red' : 'text-accent-amber'}>{item.status === 'ready' ? 'awaiting input' : item.status}</span></div>
          <p className="text-[11px] text-white/80 truncate mt-1">{item.title}</p>
          <p className="text-[9px] text-white/30 mt-1">{item.turns} turns · {new Date(item.updatedAt).toLocaleDateString()}</p>
        </button>
      ))}</div>}
      {history && visible.length === 0 && <p className="text-xs text-white/40 py-3">No parked sessions yet. Park a finished task to keep it here.</p>}

      {session && <div className="flex items-center justify-between gap-2 text-[10px] text-white/40">
        <span title={session.threadId} className="truncate">{session.projectPath}</span>
        <button disabled={session.status === 'working'} onClick={() => archive(session.id, !session.archived)} className="flex items-center gap-1 shrink-0 text-white/60 disabled:opacity-30">{session.archived ? <RotateCcw size={12} /> : <Archive size={12} />}{session.archived ? 'Restore' : 'Park session'}</button>
      </div>}
      <div ref={scrollRef} className="max-h-[48vh] min-h-[200px] overflow-y-auto space-y-3 py-2">
        {!session && <div className="py-10 text-center">
          <Terminal size={28} className="mx-auto mb-3 text-accent-amber/70" />
          <h4 className="text-sm text-white/80">Work on a project with Codex</h4>
          <p className="text-xs text-white/40 mt-2 max-w-sm mx-auto">Read and edit files, run commands, and continue saved sessions. Choose a folder and send a task below.</p>
        </div>}
        {session?.messages.map(message => message.role === 'user' ? (
          <div key={message.id} className="ml-8 bg-accent-blue/10 border border-accent-blue/15 p-3 rounded-lg text-xs text-white/80 whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <div key={message.id} className="border-l-2 border-accent-amber pl-3 text-xs text-white/80 leading-relaxed break-words">
            <p className="text-[10px] text-accent-amber mb-1">Codex</p>
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
          </div>
        ))}
        {session?.status === 'working' && <p className="flex items-center gap-2 text-xs text-accent-amber"><Loader2 size={12} className="animate-spin" /> Codex is working…</p>}
        {session?.error && <p role="alert" className="text-xs text-accent-red whitespace-pre-wrap">{session.error}</p>}
        {session?.status === 'stopped' && <p className="text-xs text-white/50">Stopped. Send a follow-up to continue this session.</p>}
      </div>
      {session && session.activity.length > 0 && <details open={session.status === 'working'} className="bg-surface-2 border border-white/5 rounded-lg p-2">
        <summary className="text-[11px] text-white/60 cursor-pointer">Live activity · {session.activity.length} events</summary>
        <div className="max-h-40 overflow-y-auto mt-2 space-y-2">{session.activity.map(activity => <div key={activity.id}>
          <span className="text-[9px] text-accent-amber">{activity.kind.replace(/_/g, ' ')} {activity.status && `· ${activity.status}`}</span>
          <pre className="text-[10px] text-white/50 whitespace-pre-wrap break-all font-mono">{activity.text}</pre>
        </div>)}</div>
      </details>}
      {session && <div className="text-[10px] text-white/40 flex flex-wrap gap-x-4 gap-y-1">
        <span>{session.turns} turns</span><span>{session.tokensIn.toLocaleString()} input / {session.tokensOut.toLocaleString()} output tokens</span>
        <span>{session.filesChanged.length} files changed</span>
        {session.imported && <span>Usage and file changes tracked since import</span>}
        {session.filesChanged.length > 0 && <details className="w-full"><summary className="cursor-pointer">Changed files</summary><pre className="whitespace-pre-wrap mt-1">{session.filesChanged.join('\n')}</pre></details>}
      </div>}
      {session && <CodexMemory key={session.id} session={session} />}
      <CodexComposer key={selectedId || 'new'} session={session} />
    </div>
  )
}
