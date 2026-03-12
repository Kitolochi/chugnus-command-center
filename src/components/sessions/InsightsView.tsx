import { useState } from 'react'
import { useSessionsStore } from '../../store'
import { renderMarkdown } from '../../utils/markdown'

export default function InsightsView() {
  const { insights, syncStatus, loading, generatingInsights, generateInsights } = useSessionsStore()

  const today = new Date().toISOString().split('T')[0]
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [reportType, setReportType] = useState<'daily_activity' | 'agent_analysis'>('daily_activity')

  const handleGenerate = () => {
    generateInsights(reportType, dateFrom, dateTo)
  }

  if (loading && !insights) {
    return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Sync status card */}
      {syncStatus && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-muted">Last sync:</span>{' '}
              <span className="text-white">{new Date(syncStatus.last_sync).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted">Synced:</span>{' '}
              <span className="text-accent-emerald">{syncStatus.stats.synced}</span>
            </div>
            <div>
              <span className="text-muted">Skipped:</span>{' '}
              <span className="text-white/60">{syncStatus.stats.skipped}</span>
            </div>
            {syncStatus.stats.failed > 0 && (
              <div>
                <span className="text-muted">Failed:</span>{' '}
                <span className="text-red-400">{syncStatus.stats.failed}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate controls */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Report type toggle */}
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1.5">Type</label>
            <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
              <button
                onClick={() => setReportType('daily_activity')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  reportType === 'daily_activity'
                    ? 'bg-accent-purple/20 text-accent-purple'
                    : 'text-muted hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Daily Activity
              </button>
              <button
                onClick={() => setReportType('agent_analysis')}
                className={`px-3 py-1.5 text-xs transition-colors border-l border-white/[0.06] ${
                  reportType === 'agent_analysis'
                    ? 'bg-accent-purple/20 text-accent-purple'
                    : 'text-muted hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Agent Analysis
              </button>
            </div>
          </div>

          {/* Date from */}
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1.5">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-accent-blue/40 [color-scheme:dark]"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1.5">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-accent-blue/40 [color-scheme:dark]"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generatingInsights}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-accent-purple/20 text-accent-purple rounded-lg hover:bg-accent-purple/30 transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${generatingInsights ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            {generatingInsights ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Daily insight cards */}
      {insights?.insights && insights.insights.length > 0 ? (
        <div className="space-y-4">
          {insights.insights.map((insight) => (
            <div key={insight.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-accent-blue">{insight.date_from}</span>
                {insight.date_from !== insight.date_to && (
                  <span className="text-xs text-muted">to {insight.date_to}</span>
                )}
                <span className="text-[10px] text-muted ml-auto">{insight.type}</span>
              </div>
              <div
                className="prose prose-invert prose-sm max-w-none text-white/80 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-medium [&_h3]:text-xs [&_h3]:font-medium [&_p]:text-xs [&_li]:text-xs [&_hr]:border-white/[0.06] [&_code]:text-accent-blue [&_code]:bg-white/[0.04] [&_code]:px-1 [&_code]:rounded"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(insight.content) }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
          </div>
          <p className="text-muted text-sm">No insights generated yet</p>
          <p className="text-muted/60 text-xs mt-1">Select a date range and type, then click Generate</p>
        </div>
      )}
    </div>
  )
}
