import { useState, useMemo } from 'react'
import { useAgentStore } from '../../store'

type Period = 'today' | 'week' | 'month'

export default function CostDashboard() {
  const { agents, costEvents } = useAgentStore()
  const [period, setPeriod] = useState<Period>('month')

  const periodStart = useMemo(() => {
    const now = new Date()
    switch (period) {
      case 'today':
        return now.toISOString().split('T')[0]
      case 'week': {
        const d = new Date(now)
        d.setDate(d.getDate() - 7)
        return d.toISOString().split('T')[0]
      }
      case 'month':
        return now.toISOString().slice(0, 8) + '01'
    }
  }, [period])

  const filteredEvents = useMemo(() =>
    costEvents.filter(e => e.timestamp >= periodStart),
    [costEvents, periodStart]
  )

  const totalCents = filteredEvents.reduce((sum, e) => sum + e.costCents, 0)
  const totalTokens = filteredEvents.reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0)

  const perAgent = useMemo(() => {
    const map = new Map<string, { name: string; cents: number; tokens: number; events: number }>()
    for (const agent of agents) {
      map.set(agent.id, { name: agent.name, cents: 0, tokens: 0, events: 0 })
    }
    for (const e of filteredEvents) {
      const entry = map.get(e.agentId)
      if (entry) {
        entry.cents += e.costCents
        entry.tokens += e.inputTokens + e.outputTokens
        entry.events += 1
      }
    }
    return Array.from(map.values())
      .filter(a => a.events > 0)
      .sort((a, b) => b.cents - a.cents)
  }, [agents, filteredEvents])

  const maxCents = perAgent.length > 0 ? Math.max(...perAgent.map(a => a.cents)) : 1

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Cost Tracking</h2>
        <div className="flex gap-1 p-1 bg-surface-1/50 rounded-lg">
          {(['today', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                period === p ? 'bg-surface-3 text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-1/60 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/40 mb-1">Total Spend</p>
          <p className="text-2xl font-bold text-white">${(totalCents / 100).toFixed(2)}</p>
        </div>
        <div className="bg-surface-1/60 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/40 mb-1">Total Tokens</p>
          <p className="text-2xl font-bold text-white">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-surface-1/60 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/40 mb-1">Events</p>
          <p className="text-2xl font-bold text-white">{filteredEvents.length}</p>
        </div>
      </div>

      {/* Per-agent bars */}
      {perAgent.length > 0 && (
        <div className="bg-surface-1/60 border border-white/5 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Per Agent</h3>
          {perAgent.map(a => (
            <div key={a.name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">{a.name}</span>
                <span className="text-white/40">${(a.cents / 100).toFixed(2)} ({a.tokens.toLocaleString()} tokens)</span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-blue rounded-full transition-all"
                  style={{ width: `${(a.cents / maxCents) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent events table */}
      <div className="bg-surface-1/60 border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white/70">Recent Events</h3>
        </div>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">No cost events in this period</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredEvents.slice(0, 20).map(e => (
              <div key={e.id} className="px-4 py-2 flex items-center gap-4 text-xs">
                <span className="text-white/60 w-32 flex-shrink-0">
                  {new Date(e.timestamp).toLocaleString()}
                </span>
                <span className="text-white/40 w-20">{e.source}</span>
                <span className="text-white/50 w-24">{e.model.split('-').pop()}</span>
                <span className="text-white/40 flex-1">{(e.inputTokens + e.outputTokens).toLocaleString()} tokens</span>
                <span className="text-white font-medium">${(e.costCents / 100).toFixed(3)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
