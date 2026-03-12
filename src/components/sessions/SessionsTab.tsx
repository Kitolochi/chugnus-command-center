import { useEffect } from 'react'
import { useSessionsStore } from '../../store'
import OverviewView from './OverviewView'
import ToolsView from './ToolsView'
import SessionsView from './SessionsView'

const SUB_VIEWS = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'tools' as const, label: 'Tools' },
  { id: 'sessions' as const, label: 'Sessions' },
]

const DATE_RANGES = [
  { value: 7 as const, label: '7d' },
  { value: 30 as const, label: '30d' },
  { value: 90 as const, label: '90d' },
  { value: null, label: 'All' },
]

export default function SessionsTab() {
  const {
    subView, setSubView, loading, error,
    loadAll, dateRange, setDateRange,
    projects, projectFilter, setProjectFilter,
    refresh,
  } = useSessionsStore()

  useEffect(() => { loadAll() }, [])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-white">Sessions</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Sub-view tabs */}
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
          {SUB_VIEWS.map(sv => (
            <button
              key={sv.id}
              onClick={() => setSubView(sv.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                subView === sv.id
                  ? 'bg-accent-blue/20 text-accent-blue'
                  : 'text-muted hover:text-white/70 hover:bg-white/[0.06]'
              }`}
            >
              {sv.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/[0.06]" />

        {/* Date range filter */}
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
          {DATE_RANGES.map(dr => (
            <button
              key={dr.label}
              onClick={() => setDateRange(dr.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                dateRange === dr.value
                  ? 'bg-accent-purple/20 text-accent-purple'
                  : 'text-muted hover:text-white/70 hover:bg-white/[0.06]'
              }`}
            >
              {dr.label}
            </button>
          ))}
        </div>

        {/* Project filter */}
        {projects?.projects && projects.projects.length > 1 && (
          <>
            <div className="w-px h-5 bg-white/[0.06]" />
            <select
              value={projectFilter ?? ''}
              onChange={e => setProjectFilter(e.target.value || null)}
              className="bg-white/[0.04] border border-white/[0.06] text-xs text-white/80 rounded-lg px-2.5 py-1.5 outline-none focus:border-accent-blue/40"
            >
              <option value="">All Projects</option>
              {projects.projects.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {/* Sub-view content */}
      {subView === 'overview' && <OverviewView />}
      {subView === 'tools' && <ToolsView />}
      {subView === 'sessions' && <SessionsView />}
    </div>
  )
}
