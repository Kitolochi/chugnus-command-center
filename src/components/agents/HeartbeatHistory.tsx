import { useState, useMemo } from 'react'
import { useAgentStore } from '../../store'

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  queued: { bg: 'bg-white/10', text: 'text-white/50' },
  running: { bg: 'bg-accent-purple/20', text: 'text-accent-purple' },
  succeeded: { bg: 'bg-accent-emerald/20', text: 'text-accent-emerald' },
  failed: { bg: 'bg-accent-red/20', text: 'text-accent-red' },
  cancelled: { bg: 'bg-white/10', text: 'text-white/40' },
  timed_out: { bg: 'bg-accent-amber/20', text: 'text-accent-amber' },
}

export default function HeartbeatHistory() {
  const { runs, agents, issues, completeRun } = useAgentStore()
  const [filterAgentId, setFilterAgentId] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredRuns = useMemo(() => {
    let result = runs
    if (filterAgentId) result = result.filter(r => r.agentId === filterAgentId)
    return result
  }, [runs, filterAgentId])

  const getAgentName = (agentId: string) =>
    agents.find(a => a.id === agentId)?.name || 'Unknown'

  const getIssueName = (issueId?: string) => {
    if (!issueId) return '-'
    return issues.find(i => i.id === issueId)?.title || 'Unknown'
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return '-'
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`
    return `${(ms / 3600000).toFixed(1)}h`
  }

  const handleMarkDone = async (runId: string) => {
    await completeRun(runId, { status: 'succeeded' })
  }

  const handleMarkFailed = async (runId: string) => {
    await completeRun(runId, { status: 'failed' })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Heartbeat History</h2>
        <select
          value={filterAgentId}
          onChange={e => setFilterAgentId(e.target.value)}
          className="px-3 py-1.5 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
        >
          <option value="">All Agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface-1/60 border border-white/5 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_1fr_100px_50px_80px_100px_80px] gap-2 px-4 py-2 border-b border-white/5 text-xs text-white/40 font-medium">
          <span>Agent</span>
          <span>Issue</span>
          <span>Status</span>
          <span>Iter</span>
          <span>Source</span>
          <span>Duration</span>
          <span>Cost</span>
        </div>

        {filteredRuns.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">No heartbeat runs yet</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredRuns.map(run => {
              const badge = STATUS_BADGES[run.status] || STATUS_BADGES.queued
              return (
                <div key={run.id}>
                  <div
                    className="grid grid-cols-[1fr_1fr_100px_50px_80px_100px_80px] gap-2 px-4 py-3 text-xs hover:bg-surface-2/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                  >
                    <span className="text-white/70 truncate">{getAgentName(run.agentId)}</span>
                    <span className="text-white/40 truncate">{getIssueName(run.issueId)}</span>
                    <span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.bg} ${badge.text}`}>
                        {run.status}
                      </span>
                    </span>
                    <span className="text-white/30">{run.iteration != null ? `#${run.iteration + 1}` : '-'}</span>
                    <span className="text-white/30">{run.source}</span>
                    <span className="text-white/40">{formatDuration(run.durationMs)}</span>
                    <span className="text-white/50">
                      {run.costCents != null ? `$${(run.costCents / 100).toFixed(3)}` : '-'}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === run.id && (
                    <div className="px-4 py-3 bg-surface-2/20 border-t border-white/5 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-white/30">Started:</span>{' '}
                          <span className="text-white/50">{new Date(run.startedAt).toLocaleString()}</span>
                        </div>
                        {run.completedAt && (
                          <div>
                            <span className="text-white/30">Completed:</span>{' '}
                            <span className="text-white/50">{new Date(run.completedAt).toLocaleString()}</span>
                          </div>
                        )}
                        {run.inputTokens != null && (
                          <div>
                            <span className="text-white/30">Tokens:</span>{' '}
                            <span className="text-white/50">{run.inputTokens?.toLocaleString()} in / {run.outputTokens?.toLocaleString()} out</span>
                          </div>
                        )}
                        {run.sessionId && (
                          <div>
                            <span className="text-white/30">Session:</span>{' '}
                            <span className="text-white/40 font-mono text-[10px]">{run.sessionId.slice(0, 16)}...</span>
                          </div>
                        )}
                      </div>

                      {run.summary && (
                        <div className="text-xs text-white/50 bg-surface-3/30 rounded-lg p-3">
                          {run.summary}
                        </div>
                      )}

                      {run.error && (
                        <div className="text-xs text-accent-red/70 bg-accent-red/5 rounded-lg p-3">
                          {run.error}
                        </div>
                      )}

                      {/* Structured result display */}
                      {run.structuredResult && (
                        <div className="space-y-2">
                          {run.structuredResult.filesChanged && run.structuredResult.filesChanged.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-white/30">Files:</span>
                              {run.structuredResult.filesChanged.map((f, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-accent-blue/10 text-accent-blue/70 font-mono">
                                  {f.split(/[/\\]/).pop()}
                                </span>
                              ))}
                            </div>
                          )}
                          {run.structuredResult.toolCalls && run.structuredResult.toolCalls.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-white/30">Tools:</span>
                              {run.structuredResult.toolCalls.map((t, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-accent-purple/10 text-accent-purple/70">
                                  {t.tool} &times;{t.count}
                                </span>
                              ))}
                            </div>
                          )}
                          {run.structuredResult.gitCommits && run.structuredResult.gitCommits.length > 0 && (
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-white/30">Commits:</span>
                              {run.structuredResult.gitCommits.map((c, i) => (
                                <div key={i} className="text-[10px] text-accent-emerald/60 pl-2">{c}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Iteration chain */}
                      {(run.parentRunId || run.iteration != null) && (
                        <div className="flex items-center gap-3 text-[10px] text-white/30">
                          {run.iteration != null && (
                            <span>Iteration <span className="text-white/50 font-medium">#{run.iteration + 1}</span></span>
                          )}
                          {run.parentRunId && (
                            <span>Parent: <span className="font-mono text-white/40">{run.parentRunId.slice(0, 12)}...</span></span>
                          )}
                        </div>
                      )}

                      {run.tags && run.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-white/30">Tags:</span>
                          {run.tags.map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-3/50 text-white/40">{tag}</span>
                          ))}
                        </div>
                      )}

                      <div className="text-xs text-white/20 bg-surface-3/20 rounded-lg p-3 max-h-32 overflow-y-auto font-mono">
                        {run.prompt.slice(0, 500)}{run.prompt.length > 500 ? '...' : ''}
                      </div>

                      {run.status === 'running' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMarkDone(run.id)}
                            className="px-3 py-1 bg-accent-emerald/10 text-accent-emerald rounded text-xs font-medium"
                          >
                            Mark Done
                          </button>
                          <button
                            onClick={() => handleMarkFailed(run.id)}
                            className="px-3 py-1 bg-accent-red/10 text-accent-red rounded text-xs font-medium"
                          >
                            Mark Failed
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
