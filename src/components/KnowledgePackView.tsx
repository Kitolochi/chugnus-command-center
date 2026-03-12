import { useState, useEffect, useCallback } from 'react'
import { KnowledgePack, CompressionProgress, CompressionAudit, MemoryHealth } from '../types'

const STATUS_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  healthy: { bg: 'bg-emerald-500/10', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  warning: { bg: 'bg-amber-500/10', dot: 'bg-amber-400', text: 'text-amber-400' },
  critical: { bg: 'bg-red-500/10', dot: 'bg-red-400', text: 'text-red-400' },
}

export default function KnowledgePackView() {
  const [packs, setPacks] = useState<KnowledgePack[]>([])
  const [health, setHealth] = useState<MemoryHealth | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [progress, setProgress] = useState<CompressionProgress | null>(null)
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null)
  const [pruning, setPruning] = useState(false)
  const [pruneResult, setPruneResult] = useState<number | null>(null)
  const [auditing, setAuditing] = useState(false)
  const [audit, setAudit] = useState<CompressionAudit | null>(null)
  const [showAuditDetails, setShowAuditDetails] = useState(false)

  const loadData = useCallback(async () => {
    const [p, h] = await Promise.all([
      window.electronAPI.getKnowledgePacks(),
      window.electronAPI.getMemoryHealth(),
    ])
    setPacks(p)
    setHealth(h)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Listen for compression progress events
  useEffect(() => {
    const unsub = window.electronAPI.onCompressionProgress((p: CompressionProgress) => {
      setProgress(p)
      if (p.phase === 'done') {
        setCompressing(false)
        loadData()
      }
    })
    return unsub
  }, [loadData])

  // Listen for health update events
  useEffect(() => {
    const unsub = window.electronAPI.onMemoryHealthUpdate((h: MemoryHealth) => {
      setHealth(h)
    })
    return unsub
  }, [])

  const handleCompress = async () => {
    setCompressing(true)
    setProgress({ phase: 'embedding', percent: 0, detail: 'Starting...' })
    setPruneResult(null)
    try {
      await window.electronAPI.compressKnowledge()
    } catch (err: any) {
      setCompressing(false)
      setProgress(null)
      console.error('Compression failed:', err)
    }
  }

  const handlePrune = async () => {
    setPruning(true)
    setPruneResult(null)
    try {
      const count = await window.electronAPI.autoPruneMemories()
      setPruneResult(count)
      await loadData()
    } catch {
      /* ignore */
    }
    setPruning(false)
  }

  const handleAudit = async () => {
    setAuditing(true)
    setAudit(null)
    try {
      const result = await window.electronAPI.auditCompression()
      setAudit(result)
    } catch (err: any) {
      console.error('Audit failed:', err)
    }
    setAuditing(false)
  }

  const latestPack = packs[0] || null

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      {/* Health Indicator */}
      {health && (
        <div className={`rounded-xl border border-white/[0.06] p-3 ${STATUS_COLORS[health.status]?.bg || ''}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[health.status]?.dot || 'bg-white/30'}`} />
              <span className={`text-[11px] font-semibold ${STATUS_COLORS[health.status]?.text || 'text-white/70'}`}>
                {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
              </span>
              <span className="text-[10px] text-muted">
                {health.totalMemories} memories
              </span>
            </div>
            <div className="flex items-center gap-2">
              {health.status !== 'healthy' && (
                <button
                  onClick={handlePrune}
                  disabled={pruning}
                  className="px-2 py-1 rounded-md bg-surface-3 hover:bg-surface-4 text-[9px] font-medium text-muted hover:text-white transition-all disabled:opacity-50"
                >
                  {pruning ? 'Pruning...' : 'Auto-Prune'}
                </button>
              )}
              <span className="text-[10px] text-muted font-mono">
                {health.budgetUsagePercent}%
              </span>
            </div>
          </div>

          {/* Usage bar */}
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                health.status === 'healthy' ? 'bg-emerald-400' :
                health.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(health.budgetUsagePercent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[9px] text-muted/70">{health.recommendation}</p>
            <span className="text-[9px] text-muted/50 font-mono shrink-0 ml-2">
              {health.totalTokens.toLocaleString()} / {health.tokenBudget.toLocaleString()} tokens
            </span>
          </div>

          {pruneResult !== null && (
            <p className="text-[9px] text-emerald-400/80 mt-1">
              {pruneResult > 0 ? `Archived ${pruneResult} memories.` : 'No memories needed pruning.'}
            </p>
          )}
        </div>
      )}

      {/* Compress Button + Progress */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCompress}
          disabled={compressing}
          className={`px-4 py-2 rounded-xl text-[11px] font-semibold transition-all ${
            compressing
              ? 'bg-accent-purple/10 text-accent-purple/50 cursor-wait'
              : 'bg-gradient-to-r from-accent-purple/20 to-accent-blue/20 hover:from-accent-purple/30 hover:to-accent-blue/30 text-accent-purple'
          }`}
        >
          {compressing ? 'Compressing...' : 'Compress Knowledge'}
        </button>

        {latestPack && !compressing && (
          <>
            <button
              onClick={handleAudit}
              disabled={auditing}
              className="px-3 py-2 rounded-xl text-[11px] font-semibold bg-surface-3 hover:bg-surface-4 text-muted hover:text-white transition-all disabled:opacity-40"
            >
              {auditing ? 'Auditing...' : 'Audit Quality'}
            </button>
            <span className="text-[9px] text-muted/50">
              Last compressed {new Date(latestPack.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </div>

      {/* Audit Results */}
      {audit && (
        <div className="bg-surface-2 rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${audit.coverageScore >= 70 ? 'bg-emerald-400' : audit.coverageScore >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} />
              <span className="text-[11px] font-semibold text-white/90">Compression Quality Audit</span>
            </div>
            <button onClick={() => setAudit(null)} className="text-[9px] text-muted hover:text-white">Dismiss</button>
          </div>

          {/* Coverage Score */}
          <div className="flex items-center gap-4 mb-3">
            <div className="text-center">
              <div className={`text-2xl font-bold ${audit.coverageScore >= 70 ? 'text-emerald-400' : audit.coverageScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {audit.coverageScore}%
              </div>
              <div className="text-[9px] text-muted">Coverage</div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[13px] font-semibold text-white/80">{audit.coveredItems}</div>
                <div className="text-[8px] text-muted">Covered</div>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white/80">{audit.uncoveredItems.length}</div>
                <div className="text-[8px] text-muted">Gaps</div>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white/80">{audit.totalOriginalItems}</div>
                <div className="text-[8px] text-muted">Total</div>
              </div>
            </div>
          </div>

          {/* Coverage bar */}
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all ${audit.coverageScore >= 70 ? 'bg-emerald-400' : audit.coverageScore >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${audit.coverageScore}%` }}
            />
          </div>

          {/* Cluster breakdown */}
          <div className="space-y-1 mb-3">
            {audit.clusterCoverage.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-[9px]">
                <span className="text-white/70 truncate flex-1">{c.label}</span>
                <span className="text-muted ml-2">{c.itemCount} items → {c.factCount} facts</span>
              </div>
            ))}
          </div>

          {/* Uncovered items (expandable) */}
          {audit.uncoveredItems.length > 0 && (
            <div>
              <button
                onClick={() => setShowAuditDetails(!showAuditDetails)}
                className="text-[9px] text-amber-400/70 hover:text-amber-400 transition-colors"
              >
                {showAuditDetails ? 'Hide' : 'Show'} {audit.uncoveredItems.length} uncovered items
              </button>
              {showAuditDetails && (
                <div className="mt-2 max-h-48 overflow-auto space-y-1.5">
                  {audit.uncoveredItems.map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-surface-3 text-[9px]">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-muted/60 font-mono">{item.source}</span>
                        <span className={`font-mono ${item.bestMatchScore < 0.3 ? 'text-red-400/70' : 'text-amber-400/70'}`}>
                          {(item.bestMatchScore * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <p className="text-white/60 leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {compressing && progress && (
        <div className="bg-surface-2 rounded-xl border border-white/[0.06] p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-white/80 font-medium capitalize">{progress.phase}</span>
            <span className="text-[10px] text-muted font-mono">{progress.percent}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-blue transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="text-[9px] text-muted/60">{progress.detail}</p>
        </div>
      )}

      {/* Knowledge Pack View */}
      {latestPack ? (
        <div className="flex-1 overflow-auto flex flex-col gap-3">
          {/* Overview Card */}
          <div className="bg-surface-2 rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent-purple/30 to-accent-blue/30 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <span className="text-[11px] font-semibold text-white/90">Knowledge Overview</span>
            </div>
            <p className="text-[10px] text-muted leading-relaxed">{latestPack.overview}</p>
          </div>

          {/* Cluster Cards */}
          <div className="grid grid-cols-1 gap-2.5">
            {latestPack.clusters.map((cluster, i) => {
              const isExpanded = expandedCluster === `${latestPack.id}-${i}`
              return (
                <div
                  key={`${latestPack.id}-${i}`}
                  onClick={() => setExpandedCluster(isExpanded ? null : `${latestPack.id}-${i}`)}
                  className={`bg-surface-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
                    isExpanded ? 'border-accent-purple/20' : 'border-white/[0.04] hover:border-accent-purple/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-3 h-3 text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-[11px] font-semibold text-white/90">{cluster.label}</span>
                    </div>
                    <span className="text-[9px] text-muted/50 font-mono">
                      {cluster.memoryCount} mem · {cluster.facts.length} facts
                    </span>
                  </div>

                  <p className="text-[10px] text-muted/70 pl-5 mb-1">{cluster.summary}</p>

                  {isExpanded && cluster.facts.length > 0 && (
                    <div className="pl-5 mt-2 pt-2 border-t border-white/[0.04] space-y-1">
                      {cluster.facts.map((fact, fi) => (
                        <div key={fi} className="flex items-start gap-1.5">
                          <div className="w-1 h-1 rounded-full bg-accent-purple/40 mt-1.5 shrink-0" />
                          <span className="text-[10px] text-white/70 leading-relaxed">{fact}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Stats Footer */}
          <div className="flex items-center justify-center gap-4 py-2 text-[9px] text-muted/40 flex-wrap">
            <span>{latestPack.stats.totalMemories} memories</span>
            <span>|</span>
            <span>{latestPack.stats.totalContextFiles || 0} context files</span>
            <span>|</span>
            <span>{latestPack.stats.totalChunks || latestPack.stats.totalMemories} chunks</span>
            <span>|</span>
            <span>{latestPack.stats.totalFacts} facts</span>
            <span>|</span>
            <span>{latestPack.clusters.length} clusters</span>
            <span>|</span>
            <span>{(latestPack.stats.durationMs / 1000).toFixed(1)}s</span>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-accent-purple/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-white/80 mb-1">No Knowledge Pack Yet</h3>
          <p className="text-[11px] text-muted mb-4 max-w-[320px]">
            Compress your memories and context files (~/.claude/memory/) into a structured knowledge base with clusters, facts, and an overview.
          </p>
          <button
            onClick={handleCompress}
            disabled={compressing}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent-purple/20 to-accent-blue/20 hover:from-accent-purple/30 hover:to-accent-blue/30 text-[11px] font-semibold text-accent-purple transition-all disabled:opacity-50"
          >
            {compressing ? 'Compressing...' : 'Compress Knowledge'}
          </button>
        </div>
      )}
    </div>
  )
}
