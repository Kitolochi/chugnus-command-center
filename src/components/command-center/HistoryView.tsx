import { useEffect, useState } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { Badge } from '../ui'
import { ChevronRight, DollarSign, FileEdit, MessageSquare, Clock, Play } from 'lucide-react'
import type { CLISession, CLISessionMessage } from '../../types'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function pathToEncoded(p: string): string {
  // "C:\Users\chris\mega-agenda" → "C--Users-chris-mega-agenda"
  return p.replace(':', '-').replace(/[\\/]/g, '-')
}

function projectNameFromEncoded(encoded: string): string {
  // "C--Users-chris-mega-agenda" → "mega-agenda"
  // Use the last path segment from the decoded path
  const dashDash = encoded.indexOf('--')
  if (dashDash === -1) return encoded
  const rest = encoded.slice(dashDash + 2)
  const lastSep = rest.lastIndexOf('-')
  if (lastSep === -1) return rest || encoded
  // Take from last path separator — but project names can have hyphens
  // So we use the known username pattern: everything after the user dir
  const parts = rest.split('-')
  const userIdx = parts.indexOf('Users')
  if (userIdx >= 0 && userIdx + 2 < parts.length) {
    // Skip "Users" and the username (next segment)
    return parts.slice(userIdx + 2).join('-')
  }
  return parts[parts.length - 1] || encoded
}

function SessionRow({ session, expandedId, onExpand, onResume, loadingMessages, expandedMessages, showBadge = true }: {
  session: CLISession
  expandedId: string | null
  onExpand: (id: string) => void
  onResume: (session: CLISession) => void
  loadingMessages: boolean
  expandedMessages: CLISessionMessage[]
  showBadge?: boolean
}) {
  return (
    <div>
      <div
        onClick={() => onExpand(session.sessionId)}
        className="bg-surface-1 border border-white/[0.04] rounded-lg px-4 py-2.5 flex items-center justify-between cursor-pointer hover:border-white/[0.08] transition-all"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ChevronRight size={10} className={`text-white/20 transition-transform flex-shrink-0 ${expandedId === session.sessionId ? 'rotate-90' : ''}`} />
          {showBadge && <Badge>{projectNameFromEncoded(session.project)}</Badge>}
          <span className="text-[10px] text-white/60 truncate">
            {session.firstPrompt || 'No prompt'}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className="text-[9px] text-white/20 flex items-center gap-1">
            <MessageSquare size={8} />{session.messageCount}
          </span>
          <span className="text-[9px] text-white/20 flex items-center gap-1">
            <Clock size={8} />{relativeTime(session.modified)}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onResume(session) }}
            title="Resume this session"
            className="p-1 rounded text-white/20 hover:text-accent-green hover:bg-white/[0.04] transition-colors"
          >
            <Play size={10} />
          </button>
        </div>
      </div>
      {expandedId === session.sessionId && (
        <div className="bg-surface-0 border border-white/[0.04] rounded-b-lg px-4 py-3 -mt-1 max-h-72 overflow-y-auto space-y-2">
          {loadingMessages ? (
            <p className="text-[10px] text-white/30">Loading messages...</p>
          ) : expandedMessages.length === 0 ? (
            <p className="text-[10px] text-white/30">No messages found.</p>
          ) : (
            expandedMessages.map((msg, i) => (
              <div key={i} className={`text-[11px] ${msg.type === 'user' ? 'text-white/70' : 'text-white/40'}`}>
                <span className={`text-[9px] font-medium uppercase mr-2 ${msg.type === 'user' ? 'text-accent-blue' : 'text-accent-purple'}`}>
                  {msg.type}
                </span>
                {msg.content.slice(0, 300)}
                {msg.content.length > 300 && <span className="text-white/20">...</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function HistoryView() {
  const { history, historyFilter, projects, loadHistory, loadProjects, setHistoryFilter, launch, setActiveView } = useCommandCenterStore()
  const [cliSessions, setCliSessions] = useState<CLISession[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<CLISessionMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [activeTab, setActiveTab] = useState<'cli' | 'cc'>('cc')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all')
  const [projectDescriptions, setProjectDescriptions] = useState<Record<string, string>>({})
  const [resumeError, setResumeError] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
    loadProjects()
    loadCliSessions()
  }, [])

  // Load project descriptions from CLAUDE.md files
  useEffect(() => {
    if (projects.length === 0) return
    const loadDescriptions = async () => {
      const descs: Record<string, string> = {}
      for (const p of projects) {
        try {
          const desc = await window.electronAPI.ccGetProjectDescription({ projectPath: p.path })
          if (desc) descs[p.path] = desc
        } catch {}
      }
      setProjectDescriptions(descs)
    }
    loadDescriptions()
  }, [projects])

  const loadCliSessions = async () => {
    const sessions = await window.electronAPI.getCliSessions()
    setCliSessions(sessions)
  }

  const handleExpandSession = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null)
      setExpandedMessages([])
      return
    }
    setExpandedId(sessionId)
    setLoadingMessages(true)
    const { messages } = await window.electronAPI.getCliSessionMessages(sessionId, 0, 20)
    setExpandedMessages(messages)
    setLoadingMessages(false)
  }

  const handleResumeSession = async (session: CLISession) => {
    const matchedProject = projects.find(p => pathToEncoded(p.path) === session.project)
    if (!matchedProject) {
      setResumeError(`Project not found for "${session.project}"`)

      setTimeout(() => setResumeError(null), 6000)
      return
    }
    try {
      await launch(matchedProject.path, session.firstPrompt || 'Continue where we left off.', { resumeSessionId: session.sessionId })
      setActiveView('queue')
    } catch (err: any) {
      setResumeError(err.message || 'Failed to resume session')
      setTimeout(() => setResumeError(null), 4000)
    }
  }

  const dateCutoff = dateFilter === 'today' ? Date.now() - 86400000
    : dateFilter === '7d' ? Date.now() - 7 * 86400000
    : dateFilter === '30d' ? Date.now() - 30 * 86400000
    : 0

  // Filter CLI sessions by project + date
  const filteredSessions = cliSessions.filter(s => {
    if (historyFilter && s.project !== pathToEncoded(historyFilter)) return false
    if (dateCutoff && new Date(s.modified).getTime() < dateCutoff) return false
    return true
  })

  return (
    <div>
      {resumeError && (
        <div className="bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2 mb-3 text-[11px] text-accent-red">
          {resumeError}
        </div>
      )}
      {/* Filter + Tab toggle */}
      <div className="flex items-center gap-3 mb-3">
        <select
          value={historyFilter || ''}
          onChange={e => setHistoryFilter(e.target.value || null)}
          className="bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[10px] text-white/70 focus:outline-none"
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.path} value={p.path}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value as any)}
          className="bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[10px] text-white/70 focus:outline-none"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>

        <div className="flex bg-surface-2 rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setActiveTab('cli')}
            className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
              activeTab === 'cli' ? 'bg-surface-4 text-white/90' : 'text-white/40 hover:text-white/60'
            }`}
          >
            CLI Sessions ({filteredSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('cc')}
            className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
              activeTab === 'cc' ? 'bg-surface-4 text-white/90' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Command Center ({history.length})
          </button>
        </div>
      </div>

      {activeTab === 'cli' ? (
        /* CLI Sessions */
        filteredSessions.length === 0 ? (
          <p className="text-[11px] text-white/30 text-center py-8">No CLI chats</p>
        ) : (
          <div className="space-y-1">
            {(() => {
              // Group by project when showing all, flat list when filtered
              if (historyFilter) {
                return filteredSessions.map(session => (
                  <SessionRow key={session.sessionId} session={session} expandedId={expandedId} onExpand={handleExpandSession} onResume={handleResumeSession} loadingMessages={loadingMessages} expandedMessages={expandedMessages} showBadge={false} />
                ))
              }
              // Group by project, sorted by most recent session in each group
              const groups = new Map<string, CLISession[]>()
              for (const s of filteredSessions) {
                const list = groups.get(s.project) || []
                list.push(s)
                groups.set(s.project, list)
              }
              const sortedGroups = Array.from(groups.entries())
                .sort((a, b) => new Date(b[1][0].modified).getTime() - new Date(a[1][0].modified).getTime())

              return sortedGroups.map(([project, sessions]) => {
                // Find matching project path for description lookup
                const projName = projectNameFromEncoded(project)
                const matchedProject = projects.find(p => p.name === projName || p.path.endsWith(projName))
                const description = matchedProject ? projectDescriptions[matchedProject.path] : ''

                return (
                <div key={project}>
                  <div className="flex items-center gap-2 py-1.5 px-1">
                    <span className="text-[10px] font-medium text-white/50">{projName}</span>
                    <span className="text-[9px] text-white/20">{sessions.length} chats</span>
                    {description && <span className="text-[9px] text-white/15 truncate max-w-[300px]">{description}</span>}
                    <div className="flex-1 border-t border-white/[0.04]" />
                  </div>
                  {sessions.map(session => (
                    <SessionRow key={session.sessionId} session={session} expandedId={expandedId} onExpand={handleExpandSession} onResume={handleResumeSession} loadingMessages={loadingMessages} expandedMessages={expandedMessages} showBadge={false} />
                  ))}
                </div>
              )})
            })()}
          </div>
        )
      ) : (
        /* Command Center History */
        history.length === 0 ? (
          <p className="text-[11px] text-white/30 text-center py-8">No Command Center history yet. Launch a task to get started.</p>
        ) : (
          <div className="space-y-1">
            {history.map(entry => (
              <div key={entry.id}>
                <div
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className="bg-surface-1 border border-white/[0.04] rounded-lg px-4 py-2.5 flex items-center justify-between cursor-pointer hover:border-white/[0.08] transition-all"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronRight size={10} className={`text-white/20 transition-transform flex-shrink-0 ${expandedId === entry.id ? 'rotate-90' : ''}`} />
                    <Badge>{entry.projectName}</Badge>
                    <span className="text-[10px] text-white/60 truncate">{entry.summary}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    {entry.status === 'running' && (
                      <span className="text-[9px] text-accent-green flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />running
                      </span>
                    )}
                    {entry.status === 'killed' && (
                      <span className="text-[9px] text-accent-red">killed</span>
                    )}
                    <span className="text-[9px] text-white/20 flex items-center gap-1">
                      <DollarSign size={8} />{entry.costUsd.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-white/20 flex items-center gap-1">
                      <FileEdit size={8} />{entry.filesChanged.length}
                    </span>
                    <span className="text-[9px] text-white/20">
                      {new Date(entry.completedAt || entry.startedAt).toLocaleDateString()}
                    </span>
                    {entry.sessionId && entry.status !== 'running' && (
                      <button
                        onClick={async e => {
                          e.stopPropagation()
                          try {
                            await launch(entry.projectPath, entry.prompt || 'Continue where we left off.', { resumeSessionId: entry.sessionId })
                            setActiveView('queue')
                          } catch (err: any) {
                            setResumeError(err.message || 'Failed to resume session')
                            setTimeout(() => setResumeError(null), 4000)
                          }
                        }}
                        title="Resume this session"
                        className="p-1 rounded text-white/20 hover:text-accent-green hover:bg-white/[0.04] transition-colors"
                      >
                        <Play size={10} />
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === entry.id && (
                  <div className="bg-surface-0 border border-white/[0.04] rounded-b-lg px-4 py-3 -mt-1 space-y-2">
                    <div>
                      <span className="text-[9px] text-white/30 uppercase">Prompt</span>
                      <p className="text-[11px] text-white/60 mt-0.5">{entry.prompt}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/30 uppercase">Summary</span>
                      <p className="text-[11px] text-white/60 mt-0.5">{entry.summary}</p>
                    </div>
                    {entry.filesChanged.length > 0 && (
                      <div>
                        <span className="text-[9px] text-white/30 uppercase">Files ({entry.filesChanged.length})</span>
                        <div className="mt-1 space-y-0.5">
                          {entry.filesChanged.map((f, i) => (
                            <div key={i} className="text-[10px] text-white/40 font-mono">{f}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-4 text-[9px] text-white/30 pt-1">
                      <span>Cost: ${entry.costUsd.toFixed(4)}</span>
                      <span>Turns: {entry.turnCount}</span>
                      {entry.completedAt > 0 && (
                        <span>Duration: {Math.round((entry.completedAt - entry.startedAt) / 60000)}m</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
