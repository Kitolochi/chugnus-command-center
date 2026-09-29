import { useEffect, useState } from 'react'
import { ChevronRight, Clock, Play } from 'lucide-react'
import { Badge } from '../ui'
import { useCodexStore } from '../../store/codexStore'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import type { CodexHistoryEntry, CodexSession } from '../../types/codex'

const filterClass =
  'bg-surface-2 border border-white/[0.06] rounded-lg px-2 py-1 text-[10px] text-white/60 focus:outline-none'

export default function CodexHistory() {
  const { sessions, update, select, archive } = useCodexStore()
  const selectedProject = useCommandCenterStore((s) => s.selectedProject)
  const [entries, setEntries] = useState<CodexHistoryEntry[]>([])
  const [tab, setTab] = useState<'cli' | 'cc'>('cli')
  const [project, setProject] = useState('')
  const [days, setDays] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [transcripts, setTranscripts] = useState<Record<string, CodexSession['messages']>>({})
  const [indexing, setIndexing] = useState(false)
  const [indexMessage, setIndexMessage] = useState('')
  useEffect(() => {
    let disposed = false
    window.electronAPI
      .codexHistory()
      .then((result) => {
        if (!disposed) setEntries(result)
      })
      .catch((err) => {
        if (!disposed) setError(String(err))
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [])
  const open = async (entry: CodexHistoryEntry) => {
    setOpening(entry.threadId)
    setError('')
    try {
      const session = await window.electronAPI.codexImport(entry.threadId)
      update(session)
      if (session.archived) await archive(session.id, false)
      else select(session.id)
    } catch (err) {
      setError(String(err))
    } finally {
      setOpening(null)
    }
  }
  const expand = async (entry: CodexHistoryEntry) => {
    setExpanded(expanded === entry.threadId ? null : entry.threadId)
    if (transcripts[entry.threadId]) return
    try {
      const messages = await window.electronAPI.codexTranscript(entry.threadId)
      setTranscripts((current) => ({ ...current, [entry.threadId]: messages }))
    } catch (err) {
      setError(String(err))
    }
  }
  const cutoff = days === 1 ? new Date().setHours(0, 0, 0, 0) : days ? Date.now() - days * 86400000 : 0
  const matches = (entry: { projectPath: string; updatedAt: number }) =>
    (!(selectedProject || project) || entry.projectPath === (selectedProject || project)) && entry.updatedAt >= cutoff
  const visible = entries.filter(matches)
  const archived = sessions.filter((s) => s.archived && matches(s))
  const projects = [...new Set([...entries, ...sessions].map((s) => s.projectPath))].sort()
  const index = async () => {
    setIndexing(true)
    setError('')
    setIndexMessage('')
    try {
      const result = await window.electronAPI.rebuildVectorIndex()
      setIndexMessage(`Knowledge search updated: ${result.total.toLocaleString()} chunks indexed.`)
    } catch (err) {
      setError(String(err))
    } finally {
      setIndexing(false)
    }
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          {!selectedProject && (
            <select
              aria-label="Filter Codex history by project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className={filterClass}
            >
              <option value="">All Projects</option>
              {projects.map((path) => (
                <option key={path} value={path}>
                  {path.split(/[/\\]/).pop()}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Filter Codex history by date"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className={filterClass}
          >
            <option value={0}>All Time</option>
            <option value={1}>Today</option>
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
        </div>
        <div className="flex bg-surface-2 rounded-lg p-0.5">
          {(['cli', 'cc'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`px-2.5 py-1 text-[10px] font-accent tracking-wide rounded-md transition-all ${tab === value ? 'bg-surface-4 text-white/90' : 'text-white/40 hover:text-white/60'}`}
            >
              {value === 'cli' ? `CLI Sessions (${visible.length})` : `Command Center (${archived.length})`}
            </button>
          ))}
        </div>
      </div>
      {loading && tab === 'cli' && <p className="text-[11px] text-white/30 text-center py-8">Loading sessions...</p>}
      {error && (
        <p role="alert" className="text-xs text-accent-red mb-3">
          {error}
        </p>
      )}
      {tab === 'cli' ? (
        <div className="space-y-1">
          {visible.map((entry) => (
            <div key={entry.threadId}>
              <div
                onClick={() => void expand(entry)}
                className="bg-surface-1 border border-white/[0.04] rounded-lg px-4 py-2.5 flex items-center justify-between cursor-pointer hover:border-white/[0.08] transition-all"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ChevronRight
                    size={10}
                    className={`text-white/20 shrink-0 transition-transform ${expanded === entry.threadId ? 'rotate-90' : ''}`}
                  />
                  <Badge>{entry.projectPath.split(/[/\\]/).pop()}</Badge>
                  <span className="text-[10px] text-white/60 truncate">{entry.title || 'No prompt'}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-[9px] text-white/20 flex items-center gap-1">
                    <Clock size={8} />
                    {new Date(entry.updatedAt).toLocaleDateString()}
                  </span>
                  <button
                    aria-label={`Resume ${entry.title}`}
                    title="Resume this session"
                    disabled={!!opening}
                    onClick={(e) => {
                      e.stopPropagation()
                      void open(entry)
                    }}
                    className="p-1 rounded text-white/20 hover:text-accent-emerald hover:bg-white/[0.04] disabled:opacity-30"
                  >
                    <Play size={10} />
                  </button>
                </div>
              </div>
              {expanded === entry.threadId && (
                <div className="bg-surface-0 border border-white/[0.04] rounded-b-lg px-4 py-3 -mt-1 max-h-72 overflow-y-auto space-y-2">
                  {transcripts[entry.threadId] ? (
                    transcripts[entry.threadId].map((message) => (
                      <div key={message.id} className="text-[10px] whitespace-pre-wrap break-words">
                        <span className={message.role === 'user' ? 'text-accent-blue' : 'text-accent-amber'}>
                          {message.role === 'user' ? 'You' : 'Codex'}:{' '}
                        </span>
                        <span className="text-white/60">{message.content}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-white/30">Loading messages...</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {!loading && !visible.length && <p className="text-[11px] text-white/30 text-center py-8">No CLI chats</p>}
        </div>
      ) : (
        <div className="space-y-1">
          {(['parked', 'completed', 'killed'] as const).map((disposition) => {
            const items = archived.filter((s) => (s.disposition || 'parked') === disposition)
            return items.length ? (
              <div key={disposition} className="mb-3">
                <div className="flex items-center gap-2 py-1.5 px-1 mb-1">
                  <span
                    className={`text-[10px] font-accent tracking-wide ${disposition === 'parked' ? 'text-accent-amber' : 'text-accent-emerald'}`}
                  >
                    {disposition === 'parked' ? 'Parked' : disposition === 'completed' ? 'Completed' : 'Killed'}
                  </span>
                  <div className="flex-1 border-t border-white/[0.04]" />
                </div>
                {items.map((session) => (
                  <div
                    key={session.id}
                    className="bg-surface-1 border border-white/[0.04] rounded-lg px-4 py-2.5 flex items-center justify-between mb-1"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge>{session.projectPath.split(/[/\\]/).pop()}</Badge>
                      <span className="text-[10px] text-white/60 truncate">{session.title}</span>
                    </div>
                    <button
                      onClick={() => void archive(session.id, false)}
                      className="ml-2 px-2.5 py-1 rounded-md bg-accent-amber/15 text-accent-amber text-[10px] font-accent hover:bg-accent-amber/25"
                    >
                      Resume
                    </button>
                  </div>
                ))}
              </div>
            ) : null
          })}
          {!archived.length && (
            <p className="text-[11px] text-white/30 text-center py-8">
              No Command Center history yet. Launch a task to get started.
            </p>
          )}
        </div>
      )}
      <details className="mt-4 text-[10px] text-white/30">
        <summary className="cursor-pointer">Knowledge search</summary>
        <button onClick={index} disabled={indexing} className="mt-2 text-accent-amber disabled:opacity-40">
          {indexing ? 'Indexing knowledge and sessions...' : 'Update knowledge search index'}
        </button>
        {indexMessage && <p role="status">{indexMessage}</p>}
      </details>
    </div>
  )
}
