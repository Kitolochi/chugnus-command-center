import { useEffect } from 'react'
import { useSessionsStore } from '../../store'
import OverviewView from './OverviewView'
import ToolsView from './ToolsView'
import VelocityView from './VelocityView'
import SessionsView from './SessionsView'
import InsightsView from './InsightsView'

const SUB_VIEWS = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'tools' as const, label: 'Tools' },
  { id: 'velocity' as const, label: 'Velocity' },
  { id: 'sessions' as const, label: 'Sessions' },
  { id: 'insights' as const, label: 'Insights' },
]

const DATE_RANGES = [
  { value: 7 as const, label: '7d' },
  { value: 30 as const, label: '30d' },
  { value: 90 as const, label: '90d' },
  { value: null, label: 'All' },
]

export default function SessionsTab() {
  const {
    subView, setSubView, online, loading, error, syncStatus,
    loadAll, checkOnline, dateRange, setDateRange,
    syncing, syncSessions, projects, projectFilter, setProjectFilter,
    processStatus, startingProcess, startProcess, stopProcess,
  } = useSessionsStore()

  useEffect(() => { loadAll() }, [])

  if (online === false) {
    if (startingProcess) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
          <div className="w-5 h-5 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
          <p className="text-muted text-sm">Starting AgentsView...</p>
        </div>
      )
    }

    if (processStatus === 'not-installed') {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white/80 font-medium mb-1">AgentsView not installed</h3>
            <p className="text-muted text-sm max-w-md">
              Install AgentsView to see session analytics.
              Visit <button onClick={() => window.electronAPI.openExternal('https://github.com/anthropics/agentsview')} className="text-accent-blue hover:underline">github.com/anthropics/agentsview</button> for setup instructions.
            </p>
          </div>
          <button
            onClick={() => { checkOnline().then(ok => { if (ok) loadAll() }) }}
            className="px-4 py-2 bg-accent-blue/20 text-accent-blue rounded-lg text-sm hover:bg-accent-blue/30 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )
    }

    // processStatus === 'stopped'
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <svg className="w-7 h-7 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3zM8 9h2v12H8zM13 5h2v16h-2zM18 10h2v11h-2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-white/80 font-medium mb-1">AgentsView is not running</h3>
          <p className="text-muted text-sm max-w-md">
            Start the local AgentsView server to see session analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startProcess}
            className="px-4 py-2 bg-accent-green/20 text-accent-green rounded-lg text-sm hover:bg-accent-green/30 transition-colors font-medium"
          >
            Start AgentsView
          </button>
          <button
            onClick={() => { checkOnline().then(ok => { if (ok) loadAll() }) }}
            className="px-4 py-2 bg-white/[0.04] text-muted rounded-lg text-sm hover:bg-white/[0.08] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (online === null && loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" title="AgentsView running" />
          <h1 className="text-xl font-semibold text-white">Sessions</h1>
          {syncStatus && (
            <span className="text-xs text-muted bg-white/[0.04] px-2 py-1 rounded-full">
              Last sync: {new Date(syncStatus.last_sync).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Sync buttons */}
          <button
            onClick={() => syncSessions(false)}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors disabled:opacity-50"
            title="Sync new sessions"
          >
            <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={() => syncSessions(true)}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors disabled:opacity-50"
            title="Full resync — re-scan all sessions"
          >
            Full Resync
          </button>
          <div className="w-px h-5 bg-white/[0.06]" />
          {/* Refresh */}
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <div className="w-px h-5 bg-white/[0.06]" />
          <button
            onClick={stopProcess}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors"
            title="Stop AgentsView server"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop
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
      {subView === 'velocity' && <VelocityView />}
      {subView === 'sessions' && <SessionsView />}
      {subView === 'insights' && <InsightsView />}
    </div>
  )
}
