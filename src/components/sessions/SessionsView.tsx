import { useState, useCallback } from 'react'
import { useSessionsStore } from '../../store'
import HistogramChart from './HistogramChart'
import SessionDetailPanel from './SessionDetailPanel'

export default function SessionsView() {
  const {
    sessions, sessionList, loading, searchQuery, setSearchQuery,
    selectedSessionId, selectSession, searchResults, searchMessages,
  } = useSessionsStore()
  const [localSearch, setLocalSearch] = useState(searchQuery)

  const handleSearchSubmit = useCallback(() => {
    setSearchQuery(localSearch)
    if (localSearch.trim()) {
      searchMessages(localSearch)
    }
  }, [localSearch, setSearchQuery, searchMessages])

  const handleClearSearch = useCallback(() => {
    setLocalSearch('')
    setSearchQuery('')
    useSessionsStore.setState({ searchResults: null })
  }, [setSearchQuery])

  if (loading && !sessions) {
    return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Histograms */}
      {sessions && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HistogramChart
            title="Message Length Distribution"
            buckets={sessions.length_distribution}
            color="rgba(59, 130, 246, 0.7)"
          />
          <HistogramChart
            title="Duration Distribution"
            buckets={sessions.duration_distribution}
            color="rgba(168, 85, 247, 0.7)"
          />
          <HistogramChart
            title="Autonomy Distribution"
            buckets={sessions.autonomy_distribution}
            color="rgba(16, 185, 129, 0.7)"
          />
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearchSubmit() }}
            placeholder="Search message content..."
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-xs text-white/80 placeholder-white/30 outline-none focus:border-accent-blue/40"
          />
        </div>
        {localSearch !== searchQuery && (
          <button
            onClick={handleSearchSubmit}
            className="px-3 py-2 text-xs bg-accent-blue/20 text-accent-blue rounded-lg hover:bg-accent-blue/30 transition-colors"
          >
            Search
          </button>
        )}
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            className="px-2 py-2 text-xs text-muted hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Full-text search results with snippets */}
      {searchResults && searchResults.results.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">
            Message Search Results{' '}
            <span className="text-muted font-normal">({searchResults.results.length} matches)</span>
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {searchResults.results.map((r, i) => (
              <div
                key={`${r.session_id}-${r.ordinal}-${i}`}
                onClick={() => selectSession(r.session_id)}
                className="flex items-start gap-3 py-2.5 px-3 rounded-lg cursor-pointer hover:bg-white/[0.04] transition-colors border-b border-white/[0.03] last:border-0"
              >
                <span className={`text-[10px] font-medium uppercase tracking-wider mt-0.5 shrink-0 ${
                  r.role === 'user' ? 'text-accent-blue' : 'text-accent-purple'
                }`}>
                  {r.role}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-xs text-white/70 line-clamp-2 [&_mark]:bg-accent-blue/30 [&_mark]:text-white [&_mark]:px-0.5 [&_mark]:rounded"
                    dangerouslySetInnerHTML={{ __html: r.snippet }}
                  />
                  <div className="flex gap-3 mt-1 text-[10px] text-muted">
                    <span className="text-accent-blue">{r.project}</span>
                    <span>{new Date(r.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {searchResults && searchResults.results.length === 0 && searchQuery && (
        <div className="text-center py-8 text-xs text-muted">
          No message matches for "{searchQuery}"
        </div>
      )}

      {/* Recent sessions list */}
      {sessionList?.sessions && sessionList.sessions.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">
            {searchQuery && !searchResults ? `Results for "${searchQuery}"` : 'Recent Sessions'}{' '}
            <span className="text-muted font-normal">({sessionList.total} total)</span>
          </h3>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-1">
                <tr className="text-muted border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-3 font-medium">Project</th>
                  <th className="text-left py-2 px-3 font-medium">First Message</th>
                  <th className="text-right py-2 px-3 font-medium">Msgs</th>
                  <th className="text-right py-2 px-3 font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {sessionList.sessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => selectSession(selectedSessionId === s.id ? null : s.id)}
                    className={`border-b border-white/[0.03] cursor-pointer transition-colors ${
                      selectedSessionId === s.id
                        ? 'bg-accent-blue/10'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="py-2 pr-3 text-accent-blue">{s.project}</td>
                    <td className="py-2 px-3 text-white/70 max-w-md truncate">{s.first_message.slice(0, 80)}</td>
                    <td className="py-2 px-3 text-right text-white">{s.message_count}</td>
                    <td className="py-2 px-3 text-right text-muted whitespace-nowrap">
                      {new Date(s.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session detail panel */}
      {selectedSessionId && <SessionDetailPanel />}
    </div>
  )
}
