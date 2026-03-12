import { Agent } from '../../types'
import { useAgentStore } from '../../store'

const STATUS_COLORS: Record<Agent['status'], string> = {
  active: 'bg-accent-emerald',
  idle: 'bg-accent-blue',
  running: 'bg-accent-purple animate-pulse',
  paused: 'bg-accent-amber',
  error: 'bg-accent-red',
}

const ROLE_LABELS: Record<Agent['role'], string> = {
  engineer: 'Engineer',
  researcher: 'Researcher',
  writer: 'Writer',
  planner: 'Planner',
  designer: 'Designer',
  custom: 'Custom',
}

interface AgentCardProps {
  agent: Agent
}

export default function AgentCard({ agent }: AgentCardProps) {
  const { setEditingAgent, runAgentHeartbeat, setAgentStatus } = useAgentStore()

  const budgetPercent = agent.budgetMonthlyCents > 0
    ? Math.min(100, Math.round((agent.spentMonthlyCents / agent.budgetMonthlyCents) * 100))
    : 0
  const budgetWarning = budgetPercent >= 80

  const lastRun = agent.heartbeat?.lastRun
    ? new Date(agent.heartbeat.lastRun).toLocaleString()
    : 'Never'

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await runAgentHeartbeat(agent.id)
  }

  const handleTogglePause = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = agent.status === 'paused' ? 'idle' : 'paused'
    await setAgentStatus(agent.id, newStatus)
  }

  return (
    <div className="bg-surface-1/60 backdrop-blur-sm border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[agent.status]}`} />
          <h3 className="text-white font-semibold text-sm">{agent.name}</h3>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-white/60">
          {ROLE_LABELS[agent.role]}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-white/40 mb-3 line-clamp-2">{agent.description}</p>

      {/* Budget bar */}
      {agent.budgetMonthlyCents > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/40">Budget</span>
            <span className={budgetWarning ? 'text-accent-amber' : 'text-white/50'}>
              ${(agent.spentMonthlyCents / 100).toFixed(2)} / ${(agent.budgetMonthlyCents / 100).toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetWarning ? 'bg-accent-amber' : 'bg-accent-emerald'}`}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Heartbeat info */}
      <div className="flex items-center justify-between text-xs text-white/30 mb-3">
        <span>Last run: {lastRun}</span>
        {agent.heartbeat?.enabled && (
          <span className="text-accent-blue/60">
            {agent.heartbeat.schedule.trigger === 'interval'
              ? `Every ${agent.heartbeat.schedule.intervalMinutes}m`
              : agent.heartbeat.schedule.trigger}
          </span>
        )}
      </div>

      {/* Error display */}
      {agent.status === 'error' && agent.lastError && (
        <div className="text-xs text-accent-red/80 bg-accent-red/10 rounded-lg px-2 py-1 mb-3 truncate">
          {agent.lastError}
        </div>
      )}

      {/* Cooldown indicator */}
      {agent.cooldownUntil && new Date(agent.cooldownUntil) > new Date() && (
        <div className="text-xs text-accent-amber/80 bg-accent-amber/10 rounded-lg px-2 py-1 mb-3">
          Cooldown until {new Date(agent.cooldownUntil).toLocaleTimeString()} ({agent.consecutiveFailures} consecutive failures)
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleRun}
          disabled={agent.status === 'running'}
          className="flex-1 px-3 py-1.5 bg-accent-emerald/10 hover:bg-accent-emerald/20 text-accent-emerald rounded-lg text-xs font-medium transition-colors disabled:opacity-30"
        >
          {agent.status === 'running' ? 'Running...' : 'Run'}
        </button>
        <button
          onClick={handleTogglePause}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            agent.status === 'paused'
              ? 'bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue'
              : 'bg-accent-amber/10 hover:bg-accent-amber/20 text-accent-amber'
          }`}
        >
          {agent.status === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setEditingAgent(agent) }}
          className="px-3 py-1.5 bg-surface-3/50 hover:bg-surface-3 text-white/50 rounded-lg text-xs transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
