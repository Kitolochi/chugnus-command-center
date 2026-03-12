import { useState, useMemo } from 'react'
import { AgentEvent } from '../../types'
import { useAgentStore } from '../../store'

const TYPE_COLORS: Record<AgentEvent['type'], { bg: string; text: string }> = {
  launch: { bg: 'bg-accent-blue/20', text: 'text-accent-blue' },
  complete: { bg: 'bg-accent-emerald/20', text: 'text-accent-emerald' },
  fail: { bg: 'bg-accent-red/20', text: 'text-accent-red' },
  retry: { bg: 'bg-accent-amber/20', text: 'text-accent-amber' },
  requeue: { bg: 'bg-accent-purple/20', text: 'text-accent-purple' },
  budget_alert: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  escalation: { bg: 'bg-accent-red/20', text: 'text-accent-red' },
  cooldown: { bg: 'bg-accent-amber/20', text: 'text-accent-amber' },
  pause: { bg: 'bg-white/10', text: 'text-white/50' },
  resume: { bg: 'bg-accent-blue/20', text: 'text-accent-blue' },
  auto_relaunch: { bg: 'bg-accent-cyan/20', text: 'text-accent-cyan' },
}

export default function ActivityLog() {
  const { events, agents } = useAgentStore()
  const [filterAgentId, setFilterAgentId] = useState<string>('')

  const filteredEvents = useMemo(() => {
    if (!filterAgentId) return events
    return events.filter(e => e.agentId === filterAgentId)
  }, [events, filterAgentId])

  const getAgentName = (agentId: string) =>
    agents.find(a => a.id === agentId)?.name || 'Unknown'

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    if (diffMs < 60000) return 'just now'
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Activity Log</h2>
        <select
          value={filterAgentId}
          onChange={e => setFilterAgentId(e.target.value)}
          className="px-3 py-1.5 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
        >
          <option value="">All Agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="bg-surface-1/60 border border-white/5 rounded-xl overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">No activity events yet</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredEvents.map(event => {
              const colors = TYPE_COLORS[event.type] || TYPE_COLORS.launch
              return (
                <div key={event.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/20 transition-colors">
                  <span className="text-[10px] text-white/30 w-20 shrink-0 pt-0.5">
                    {formatTime(event.timestamp)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${colors.bg} ${colors.text}`}>
                    {event.type}
                  </span>
                  <span className="text-xs text-white/50 shrink-0">
                    {getAgentName(event.agentId)}
                  </span>
                  <span className="text-xs text-white/40 truncate">
                    {event.detail}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
