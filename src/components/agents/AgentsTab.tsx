import { useEffect, useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAgentStore } from '../../store'
import AgentCard from './AgentCard'
import AgentForm from './AgentForm'
import AgentIssueBoard from './AgentIssueBoard'
import CostDashboard from './CostDashboard'
import HeartbeatHistory from './HeartbeatHistory'
import ActivityLog from './ActivityLog'

const SUB_VIEWS = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'issues' as const, label: 'Issues' },
  { id: 'costs' as const, label: 'Costs' },
  { id: 'history' as const, label: 'History' },
  { id: 'activity' as const, label: 'Activity' },
]

const GUIDE_FLOWS = [
  {
    title: 'Tab Discovery',
    steps: [
      'Expand the AI & Dev group in the left sidebar',
      'Click Agents — should render with "No agents yet" empty state',
      'Verify the 4 sub-view tabs: Overview, Issues, Costs, History',
      'Click each sub-view — each should render without errors',
    ],
  },
  {
    title: 'Create an Agent',
    steps: [
      'Click + New Agent button',
      'Fill in: Name, Role, Description, Task Type',
      'Set Working Directory to an existing project path',
      'Leave budget at $0 (unlimited), heartbeat unchecked',
      'Click Create — agent card appears in Overview',
    ],
  },
  {
    title: 'Edit & Delete an Agent',
    steps: [
      'Click Edit on an agent card',
      'Change the name, set monthly budget',
      'Click Save — card updates with new values',
      'Click Edit again → Delete → Confirm Delete',
    ],
  },
  {
    title: 'Issues Kanban Board',
    steps: [
      'Switch to Issues sub-view',
      'Click + New Issue, fill title/priority/agent',
      'Click Create — issue appears in Backlog',
      'Click an issue to expand, use buttons to move across columns',
    ],
  },
  {
    title: 'Manual Agent Run',
    steps: [
      'Ensure agent has a cwd and a Todo issue assigned',
      'Click Run on the agent card',
      'A terminal opens with Claude Code running',
      'Agent status turns purple (running) with pulse',
      'History sub-view shows the new run entry',
    ],
  },
  {
    title: 'Mark a Run Complete',
    steps: [
      'In History, expand a "running" run entry',
      'Click Mark Done — status changes to "succeeded"',
      'Agent returns to idle, linked issue moves to in_review',
    ],
  },
  {
    title: 'Pause / Resume',
    steps: [
      'Click Pause — status dot turns amber',
      'Paused agents skip heartbeat auto-runs',
      'Click Resume — status returns to idle',
    ],
  },
  {
    title: 'Heartbeat Scheduling',
    steps: [
      'Edit agent → Enable Heartbeat Schedule',
      'Set trigger (Interval/Daily/Weekly) and timing',
      'Save — agent auto-runs on the next due tick',
    ],
  },
  {
    title: 'Cost Dashboard',
    steps: [
      'Switch to Costs sub-view',
      'Toggle period selector: Today / Week / Month',
      'Costs populate when session polling detects completed runs',
    ],
  },
  {
    title: 'Data Persistence',
    steps: [
      'Create agents, issues, and trigger runs',
      'Quit the app completely and relaunch',
      'All data persists in the JSON database',
    ],
  },
]

export default function AgentsTab() {
  const {
    agents, issues, runs, costEvents, subView, showForm, editingAgent,
    setSubView, setShowForm, setEditingAgent, loadAll,
  } = useAgentStore()
  const [showGuide, setShowGuide] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAll()
    const unsub = window.electronAPI.onAgentsUpdated(() => loadAll())
    return unsub
  }, [loadAll])

  // Close export dropdown on outside click
  useEffect(() => {
    if (!showExport) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExport])

  // Dashboard stats
  const stats = useMemo(() => {
    const totalRuns = runs.length
    const terminal = runs.filter(r => ['succeeded', 'failed', 'timed_out', 'cancelled'].includes(r.status))
    const succeeded = runs.filter(r => r.status === 'succeeded').length
    const successRate = terminal.length > 0 ? (succeeded / terminal.length) * 100 : 0
    const totalSpendCents = costEvents.reduce((sum, e) => sum + e.costCents, 0)
    const completedRuns = runs.filter(r => r.durationMs != null && r.durationMs > 0)
    const avgDurationMs = completedRuns.length > 0
      ? completedRuns.reduce((sum, r) => sum + (r.durationMs || 0), 0) / completedRuns.length
      : 0
    return { totalRuns, successRate, totalSpendCents, avgDurationMs }
  }, [runs, costEvents])

  const formatDuration = (ms: number) => {
    if (ms === 0) return '-'
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    const mins = Math.floor(ms / 60000)
    const secs = Math.round((ms % 60000) / 1000)
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h ${mins % 60}m`
  }

  // Export helpers
  const downloadFile = (data: string, filename: string, mime: string) => {
    const blob = new Blob([data], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const dateSuffix = () => new Date().toISOString().slice(0, 10)

  const toCsv = (rows: Record<string, any>[]) => {
    if (rows.length === 0) return ''
    const keys = Object.keys(rows[0])
    const header = keys.join(',')
    const lines = rows.map(row =>
      keys.map(k => {
        const v = row[k]
        const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    )
    return [header, ...lines].join('\n')
  }

  const flattenAgent = (a: any) => ({
    id: a.id, name: a.name, role: a.role, description: a.description,
    taskType: a.adapterConfig?.taskType || '', cwd: a.adapterConfig?.cwd || '',
    status: a.status, budgetMonthlyCents: a.budgetMonthlyCents,
    spentMonthlyCents: a.spentMonthlyCents, createdAt: a.createdAt,
  })

  const flattenRun = (r: any) => ({
    id: r.id, agentId: r.agentId, issueId: r.issueId || '', source: r.source,
    status: r.status, startedAt: r.startedAt, completedAt: r.completedAt || '',
    durationMs: r.durationMs ?? '', costCents: r.costCents ?? '',
    inputTokens: r.inputTokens ?? '', outputTokens: r.outputTokens ?? '',
    tags: (r.tags || []).join(';'), summary: r.summary || '',
  })

  const exportData = (type: string, format: 'csv' | 'json') => {
    setShowExport(false)
    let data: string
    const fn = `mega-agenda-${type}-${dateSuffix()}.${format}`
    if (type === 'all') {
      data = JSON.stringify({ agents, issues, runs, costEvents }, null, 2)
      downloadFile(data, fn, 'application/json')
      return
    }
    const map: Record<string, any[]> = { agents, issues, runs, costs: costEvents }
    const flatMap: Record<string, (r: any) => any> = { agents: flattenAgent, runs: flattenRun }
    const rows = map[type] || []
    if (format === 'json') {
      data = JSON.stringify(rows, null, 2)
      downloadFile(data, fn, 'application/json')
    } else {
      const flat = flatMap[type] ? rows.map(flatMap[type]) : rows
      data = toCsv(flat)
      downloadFile(data, fn, 'text/csv')
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Agents</h1>
          <p className="text-sm text-white/40 mt-1">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExport(!showExport)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-surface-2/50 transition-colors text-sm"
              title="Export Data"
            >
              &darr;
            </button>
            {showExport && (
              <div className="absolute right-0 top-10 z-50 w-56 bg-surface-2 border border-white/10 rounded-xl shadow-2xl py-1 text-xs">
                <p className="px-3 py-1.5 text-white/30 font-medium">Export</p>
                {(['agents', 'issues', 'runs', 'costs'] as const).map(type => (
                  <div key={type} className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-3/50">
                    <span className="text-white/60 capitalize">{type === 'costs' ? 'Cost Events' : type === 'runs' ? 'Run History' : type}</span>
                    <div className="flex gap-1">
                      <button onClick={() => exportData(type, 'csv')} className="px-1.5 py-0.5 rounded bg-surface-3/50 text-white/40 hover:text-white/70">CSV</button>
                      <button onClick={() => exportData(type, 'json')} className="px-1.5 py-0.5 rounded bg-surface-3/50 text-white/40 hover:text-white/70">JSON</button>
                    </div>
                  </div>
                ))}
                <div className="border-t border-white/5 mt-1 pt-1">
                  <button onClick={() => exportData('all', 'json')} className="w-full text-left px-3 py-1.5 text-white/60 hover:bg-surface-3/50">Export All (JSON)</button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowGuide(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-surface-2/50 transition-colors"
            title="Getting Started Guide"
          >
            ?
          </button>
          <button
            onClick={() => { setEditingAgent(null); setShowForm(true) }}
            className="px-4 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue rounded-lg text-sm font-medium transition-colors"
          >
            + New Agent
          </button>
        </div>
      </div>

      {/* Sub-view tabs */}
      <div className="flex gap-1 p-1 bg-surface-1/50 rounded-lg w-fit">
        {SUB_VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setSubView(v.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              subView === v.id
                ? 'bg-surface-3 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subView === 'overview' && (
        <div className="space-y-4">
          {agents.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <p className="text-lg mb-2">No agents yet</p>
              <p className="text-sm">Create an agent to get started with autonomous task execution.</p>
            </div>
          ) : (
            <>
              {/* Stats summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-surface-1/60 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-white/40 mb-1">Total Runs</p>
                  <p className="text-2xl font-bold text-white">{stats.totalRuns}</p>
                </div>
                <div className="bg-surface-1/60 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-white/40 mb-1">Success Rate</p>
                  <p className="text-2xl font-bold text-white">{stats.totalRuns > 0 ? `${stats.successRate.toFixed(1)}%` : '-'}</p>
                </div>
                <div className="bg-surface-1/60 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-white/40 mb-1">Total Spend</p>
                  <p className="text-2xl font-bold text-white">${(stats.totalSpendCents / 100).toFixed(2)}</p>
                </div>
                <div className="bg-surface-1/60 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-white/40 mb-1">Avg Duration</p>
                  <p className="text-2xl font-bold text-white">{formatDuration(stats.avgDurationMs)}</p>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                {agents.map(agent => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {subView === 'issues' && <AgentIssueBoard />}
      {subView === 'costs' && <CostDashboard />}
      {subView === 'history' && <HeartbeatHistory />}
      {subView === 'activity' && <ActivityLog />}

      {/* Agent Form Dialog — portal to body to escape backdrop-filter containing block */}
      {showForm && createPortal(
        <AgentForm
          agent={editingAgent}
          onClose={() => { setShowForm(false); setEditingAgent(null) }}
        />,
        document.body
      )}

      {/* Getting Started Guide */}
      {showGuide && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowGuide(false)}>
          <div className="bg-surface-1 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-lg font-bold text-white font-display">Getting Started with Agents</h2>
              <button onClick={() => setShowGuide(false)} className="text-white/30 hover:text-white/60 transition-colors text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              {GUIDE_FLOWS.map((flow, i) => (
                <div key={i} className="bg-surface-2/40 border border-white/5 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white/80 mb-2">
                    <span className="text-accent-blue/60 mr-1.5">{i + 1}.</span>
                    {flow.title}
                  </h3>
                  <ol className="space-y-1">
                    {flow.steps.map((step, j) => (
                      <li key={j} className="text-xs text-white/40 flex gap-2">
                        <span className="text-white/20 shrink-0">{j + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
