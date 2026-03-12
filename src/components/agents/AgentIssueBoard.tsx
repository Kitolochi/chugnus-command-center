import { useState } from 'react'
import { AgentIssue, LifecycleStage } from '../../types'
import { useAgentStore } from '../../store'

type Column = AgentIssue['status']
type Priority = AgentIssue['priority']

const STAGE_COLORS: Record<LifecycleStage, string> = {
  research: 'bg-accent-amber/20 text-accent-amber',
  development: 'bg-accent-blue/20 text-accent-blue',
  review: 'bg-accent-purple/20 text-accent-purple',
  committed: 'bg-accent-emerald/20 text-accent-emerald',
  pushed: 'bg-accent-cyan/20 text-accent-cyan',
  live: 'bg-green-500/20 text-green-400',
}

const LIFECYCLE_STAGES: (LifecycleStage | '')[] = ['', 'research', 'development', 'review', 'committed', 'pushed']

const COLUMNS: { key: Column; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: 'text-white/40' },
  { key: 'todo', label: 'Todo', color: 'text-accent-amber' },
  { key: 'in_progress', label: 'In Progress', color: 'text-accent-purple' },
  { key: 'in_review', label: 'In Review', color: 'text-accent-blue' },
  { key: 'blocked', label: 'Blocked', color: 'text-accent-red' },
  { key: 'done', label: 'Done', color: 'text-accent-emerald' },
]

const PRIORITY_DOTS: Record<Priority, string> = {
  critical: 'bg-accent-red',
  high: 'bg-accent-amber',
  medium: 'bg-accent-blue',
  low: 'bg-white/20',
}

const COMPLEXITY_COLORS: Record<string, string> = {
  S: 'bg-accent-emerald/20 text-accent-emerald',
  M: 'bg-accent-blue/20 text-accent-blue',
  L: 'bg-accent-red/20 text-accent-red',
}

const COLUMN_ORDER: Column[] = ['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done']

export default function AgentIssueBoard() {
  const { issues, agents, createIssue, updateIssue, deleteIssue, showIssueForm, setShowIssueForm } = useAgentStore()
  const [filterAgentId, setFilterAgentId] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Add form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('medium')
  const [newTags, setNewTags] = useState('')
  const [newAgentId, setNewAgentId] = useState('')
  const [newTargetStage, setNewTargetStage] = useState<LifecycleStage | ''>('')
  const [newMaxIterations, setNewMaxIterations] = useState(5)
  const [newDeliverables, setNewDeliverables] = useState('')

  const filteredIssues = filterAgentId
    ? issues.filter(i => i.assignedAgentId === filterAgentId)
    : issues

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    const deliverables = newDeliverables.split('\n').map(d => d.trim()).filter(Boolean)
    await createIssue({
      title: newTitle.trim(),
      description: newDesc.trim(),
      status: 'backlog',
      priority: newPriority,
      assignedAgentId: newAgentId || undefined,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      ...(newTargetStage ? {
        stage: 'research' as LifecycleStage,
        targetStage: newTargetStage as LifecycleStage,
        maxIterations: newMaxIterations,
        iteration: 0,
      } : {}),
      ...(deliverables.length > 0 ? { deliverables } : {}),
    })
    setNewTitle('')
    setNewDesc('')
    setNewPriority('medium')
    setNewTags('')
    setNewAgentId('')
    setNewTargetStage('')
    setNewMaxIterations(5)
    setNewDeliverables('')
    setShowIssueForm(false)
  }

  const handleMove = async (id: string, status: Column) => {
    await updateIssue(id, { status })
  }

  const getAgentName = (agentId?: string) => {
    if (!agentId) return 'Unassigned'
    return agents.find(a => a.id === agentId)?.name || 'Unknown'
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={filterAgentId}
            onChange={e => setFilterAgentId(e.target.value)}
            className="px-3 py-1.5 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
          >
            <option value="">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <button
          onClick={() => setShowIssueForm(true)}
          className="px-3 py-1.5 bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue rounded-lg text-xs font-medium transition-colors"
        >
          + New Issue
        </button>
      </div>

      {/* Add form */}
      {showIssueForm && (
        <div className="bg-surface-1/80 border border-white/10 rounded-xl p-4 space-y-3">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Issue title..."
            autoFocus
            className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:border-accent-blue/50 focus:outline-none"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description..."
            rows={2}
            className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none resize-none"
          />
          <div className="flex gap-3">
            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value as Priority)}
              className="px-3 py-1.5 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={newAgentId}
              onChange={e => setNewAgentId(e.target.value)}
              className="px-3 py-1.5 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="">Unassigned</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input
              value={newTags}
              onChange={e => setNewTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="flex-1 px-3 py-1.5 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={newTargetStage}
              onChange={e => setNewTargetStage(e.target.value as LifecycleStage | '')}
              className="px-3 py-1.5 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="">No auto-loop</option>
              {LIFECYCLE_STAGES.filter(Boolean).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {newTargetStage && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40">Max iterations:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newMaxIterations}
                  onChange={e => setNewMaxIterations(Number(e.target.value) || 5)}
                  className="w-16 px-2 py-1.5 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none text-center"
                />
              </div>
            )}
          </div>
          {newTargetStage && (
            <textarea
              value={newDeliverables}
              onChange={e => setNewDeliverables(e.target.value)}
              placeholder="Deliverables (one per line)..."
              rows={2}
              className="w-full px-3 py-2 bg-surface-2 border border-white/10 rounded-lg text-white text-sm focus:outline-none resize-none"
            />
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowIssueForm(false)}
              className="px-3 py-1.5 text-xs text-white/50 hover:text-white/70"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim()}
              className="px-3 py-1.5 bg-accent-blue/20 text-accent-blue rounded-lg text-xs font-medium disabled:opacity-30"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-6 gap-3">
        {COLUMNS.map(col => {
          const colIssues = filteredIssues.filter(i => i.status === col.key)
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>
                  {col.label}
                </span>
                <span className="text-xs text-white/20">{colIssues.length}</span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {colIssues.map(issue => (
                  <div
                    key={issue.id}
                    onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                    className="bg-surface-2/60 border border-white/5 rounded-lg p-3 hover:border-white/10 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${PRIORITY_DOTS[issue.priority]}`} />
                      {issue.estimatedComplexity && (
                        <span className={`px-1 py-0 rounded text-[9px] font-bold shrink-0 ${COMPLEXITY_COLORS[issue.estimatedComplexity] || ''}`}>
                          {issue.estimatedComplexity}
                        </span>
                      )}
                      <span className="text-xs text-white font-medium line-clamp-2">{issue.title}</span>
                    </div>
                    {issue.blockedBy && issue.blockedBy.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-accent-amber/70">
                        <span>&#128274;</span>
                        <span>Blocked by {issue.blockedBy.length} issue{issue.blockedBy.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {(issue.escalationLevel || 0) >= 2 && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent-red/20 text-accent-red">
                        ESC {issue.escalationLevel}
                      </span>
                    )}
                    {issue.stage && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${STAGE_COLORS[issue.stage] || ''}`}>
                          {issue.stage}
                        </span>
                        {issue.targetStage && (
                          <span className="text-[9px] text-white/25">
                            {(issue.iteration || 0)}/{issue.maxIterations || 5}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-white/30">{getAgentName(issue.assignedAgentId)}</span>
                      {issue.tags.length > 0 && (
                        <span className="text-[10px] text-white/20">{issue.tags[0]}</span>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {expandedId === issue.id && (
                      <div className="mt-3 pt-3 border-t border-white/5 space-y-2" onClick={e => e.stopPropagation()}>
                        {issue.description && (
                          <p className="text-xs text-white/40">{issue.description}</p>
                        )}
                        {issue.result && (
                          <div className="text-xs text-accent-emerald/70 bg-accent-emerald/5 rounded p-2">
                            {issue.result.slice(0, 200)}
                          </div>
                        )}

                        {/* Blocked-by dependencies */}
                        {issue.blockedBy && issue.blockedBy.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-white/30">Blocked by:</span>
                            <div className="flex gap-1 flex-wrap">
                              {issue.blockedBy.map(depId => {
                                const dep = issues.find(i => i.id === depId)
                                return (
                                  <span key={depId} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-3/60 text-[10px] text-white/50">
                                    {dep?.title?.slice(0, 30) || depId.slice(0, 8)}
                                    {dep?.status === 'done' && <span className="text-accent-emerald">&#10003;</span>}
                                    <button
                                      onClick={() => updateIssue(issue.id, { blockedBy: issue.blockedBy!.filter(id => id !== depId) })}
                                      className="text-accent-red/50 hover:text-accent-red ml-0.5"
                                    >
                                      &times;
                                    </button>
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Add dependency dropdown */}
                        <select
                          value=""
                          onChange={e => {
                            if (!e.target.value) return
                            const current = issue.blockedBy || []
                            if (!current.includes(e.target.value)) {
                              updateIssue(issue.id, { blockedBy: [...current, e.target.value] })
                            }
                          }}
                          className="px-2 py-1 bg-surface-3/50 border border-white/5 rounded text-[10px] text-white/40 focus:outline-none"
                        >
                          <option value="">Block by...</option>
                          {issues.filter(i => i.id !== issue.id && !issue.blockedBy?.includes(i.id)).map(i => (
                            <option key={i.id} value={i.id}>{i.title.slice(0, 40)}</option>
                          ))}
                        </select>

                        <div className="flex gap-1 flex-wrap">
                          {COLUMN_ORDER.filter(c => c !== col.key).map(c => (
                            <button
                              key={c}
                              onClick={() => handleMove(issue.id, c)}
                              className="px-2 py-0.5 bg-surface-3/50 hover:bg-surface-3 text-white/40 rounded text-[10px] transition-colors"
                            >
                              {c.replace('_', ' ')}
                            </button>
                          ))}
                          <button
                            onClick={() => deleteIssue(issue.id)}
                            className="px-2 py-0.5 text-accent-red/60 hover:text-accent-red text-[10px] transition-colors"
                          >
                            delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
