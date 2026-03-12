import { useState } from 'react'
import { Agent } from '../../types'
import { useAgentStore } from '../../store'

const ROLES: { value: Agent['role']; label: string }[] = [
  { value: 'engineer', label: 'Engineer' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'writer', label: 'Writer' },
  { value: 'planner', label: 'Planner' },
  { value: 'designer', label: 'Designer' },
  { value: 'custom', label: 'Custom' },
]

const TASK_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Default' },
  { value: 'research', label: 'Research' },
  { value: 'code', label: 'Code' },
  { value: 'writing', label: 'Writing' },
  { value: 'planning', label: 'Planning' },
  { value: 'communication', label: 'Communication' },
]

const TRIGGERS: { value: string; label: string }[] = [
  { value: 'interval', label: 'Interval' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

interface AgentFormProps {
  agent: Agent | null
  onClose: () => void
}

export default function AgentForm({ agent, onClose }: AgentFormProps) {
  const { createAgent, updateAgent, deleteAgent } = useAgentStore()

  const [name, setName] = useState(agent?.name || '')
  const [role, setRole] = useState<Agent['role']>(agent?.role || 'engineer')
  const [description, setDescription] = useState(agent?.description || '')
  const [taskType, setTaskType] = useState<'research' | 'code' | 'writing' | 'planning' | 'communication' | ''>(agent?.adapterConfig?.taskType || '')
  const [cwd, setCwd] = useState(agent?.adapterConfig?.cwd || '')
  const [preamble, setPreamble] = useState(agent?.adapterConfig?.preamble || '')
  const [budgetDollars, setBudgetDollars] = useState(
    agent ? (agent.budgetMonthlyCents / 100).toString() : '0'
  )
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(agent?.heartbeat?.enabled || false)
  const [trigger, setTrigger] = useState<'interval' | 'daily' | 'weekly'>(agent?.heartbeat?.schedule?.trigger || 'interval')
  const [intervalMinutes, setIntervalMinutes] = useState(
    agent?.heartbeat?.schedule?.intervalMinutes?.toString() || '60'
  )
  const [time, setTime] = useState(agent?.heartbeat?.schedule?.time || '09:00')
  const [dayOfWeek, setDayOfWeek] = useState(
    agent?.heartbeat?.schedule?.dayOfWeek?.toString() || '1'
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return

    const data = {
      name: name.trim(),
      role,
      description: description.trim(),
      adapter: 'claude_local' as const,
      adapterConfig: {
        taskType: (taskType || undefined) as Agent['adapterConfig']['taskType'],
        cwd: cwd.trim() || undefined,
        preamble: preamble.trim() || undefined,
      },
      budgetMonthlyCents: Math.round(parseFloat(budgetDollars || '0') * 100),
      heartbeat: heartbeatEnabled ? {
        enabled: true,
        schedule: {
          trigger: trigger as 'interval' | 'daily' | 'weekly',
          ...(trigger === 'interval' ? { intervalMinutes: parseInt(intervalMinutes) || 60 } : {}),
          ...(trigger === 'daily' || trigger === 'weekly' ? { time } : {}),
          ...(trigger === 'weekly' ? { dayOfWeek: parseInt(dayOfWeek) } : {}),
        },
        lastRun: agent?.heartbeat?.lastRun,
      } : undefined,
    }

    if (agent) {
      await updateAgent(agent.id, data)
    } else {
      await createAgent(data as any)
    }
    onClose()
  }

  const handleDelete = async () => {
    if (!agent) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await deleteAgent(agent.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface-1 border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-lg font-bold text-white font-display">
            {agent ? 'Edit Agent' : 'New Agent'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Code Agent"
              className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:border-accent-blue/50 focus:outline-none"
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as Agent['role'])}
              className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:border-accent-blue/50 focus:outline-none"
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              rows={2}
              className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:border-accent-blue/50 focus:outline-none resize-none"
            />
          </div>

          {/* Task Type */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Task Type</label>
            <select
              value={taskType}
              onChange={e => setTaskType(e.target.value as typeof taskType)}
              className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:border-accent-blue/50 focus:outline-none"
            >
              {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Working Directory */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Working Directory</label>
            <input
              value={cwd}
              onChange={e => setCwd(e.target.value)}
              placeholder="e.g. C:\Users\username\my-project"
              className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:border-accent-blue/50 focus:outline-none"
            />
          </div>

          {/* Custom Preamble */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Custom Preamble (optional)</label>
            <textarea
              value={preamble}
              onChange={e => setPreamble(e.target.value)}
              placeholder="Custom system prompt override..."
              rows={2}
              className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:border-accent-blue/50 focus:outline-none resize-none"
            />
          </div>

          {/* Budget */}
          <div>
            <label className="text-xs text-white/50 mb-1 block">Monthly Budget ($, 0 = unlimited)</label>
            <input
              type="number"
              value={budgetDollars}
              onChange={e => setBudgetDollars(e.target.value)}
              min="0"
              step="1"
              className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:border-accent-blue/50 focus:outline-none"
            />
          </div>

          {/* Heartbeat Schedule */}
          <div className="border-t border-white/5 pt-4">
            <label className="flex items-center gap-2 text-sm text-white/70 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={heartbeatEnabled}
                onChange={e => setHeartbeatEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-surface-2 border-white/20"
              />
              Enable Heartbeat Schedule
            </label>

            {heartbeatEnabled && (
              <div className="space-y-3 ml-6">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Trigger</label>
                  <select
                    value={trigger}
                    onChange={e => setTrigger(e.target.value as 'interval' | 'daily' | 'weekly')}
                    className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                  >
                    {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {trigger === 'interval' && (
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Interval (minutes)</label>
                    <input
                      type="number"
                      value={intervalMinutes}
                      onChange={e => setIntervalMinutes(e.target.value)}
                      min="5"
                      className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                    />
                  </div>
                )}

                {(trigger === 'daily' || trigger === 'weekly') && (
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Time</label>
                    <input
                      type="time"
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                    />
                  </div>
                )}

                {trigger === 'weekly' && (
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Day of Week</label>
                    <select
                      value={dayOfWeek}
                      onChange={e => setDayOfWeek(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                    >
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
          <div>
            {agent && (
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors"
              >
                {confirmDelete ? 'Confirm Delete' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-4 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
            >
              {agent ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
