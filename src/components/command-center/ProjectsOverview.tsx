import { useCommandCenterStore } from '../../store/commandCenterStore'
import { EmptyState } from '../ui'
import { Layers } from 'lucide-react'
import ProjectCard from './ProjectCard'
import type { ProjectSummary } from './ProjectCard'
import type { CCQueueItem } from '../../store/commandCenterStore'

function deriveProjects(queue: CCQueueItem[]): ProjectSummary[] {
  const groups = new Map<string, CCQueueItem[]>()
  for (const item of queue) {
    const existing = groups.get(item.projectPath) || []
    existing.push(item)
    groups.set(item.projectPath, existing)
  }

  const summaries: ProjectSummary[] = []
  for (const [path, items] of groups) {
    const latest = items.reduce((a, b) => a.lastActivityAt > b.lastActivityAt ? a : b)
    summaries.push({
      path,
      name: items[0].projectName,
      color: items[0].projectColor,
      workingCount: items.filter(i => i.status === 'working').length,
      awaitingCount: items.filter(i => i.status === 'awaiting_input').length,
      erroredCount: items.filter(i => i.status === 'errored').length,
      lastPrompt: latest.prompt,
      lastActivity: latest.lastActivityAt,
    })
  }

  // Sort: projects needing attention first (awaiting or errored), then by last activity
  summaries.sort((a, b) => {
    const aNeedsAttention = a.awaitingCount + a.erroredCount
    const bNeedsAttention = b.awaitingCount + b.erroredCount
    if (aNeedsAttention > 0 && bNeedsAttention === 0) return -1
    if (bNeedsAttention > 0 && aNeedsAttention === 0) return 1
    return b.lastActivity - a.lastActivity
  })

  return summaries
}

export default function ProjectsOverview() {
  const { queue, setLaunchOpen } = useCommandCenterStore()
  const projects = deriveProjects(queue)

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<Layers size={20} className="text-white/30" />}
        title="No active projects"
        description="Launch a task to get started."
        action={{ label: 'New Task', onClick: () => setLaunchOpen(true) }}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {projects.map(p => (
        <ProjectCard key={p.path} project={p} />
      ))}
    </div>
  )
}
