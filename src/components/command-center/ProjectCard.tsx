import { Plus } from 'lucide-react'
import { useCommandCenterStore } from '../../store/commandCenterStore'

export interface ProjectSummary {
  path: string
  name: string
  color: string
  workingCount: number
  awaitingCount: number
  erroredCount: number
  lastPrompt: string
  lastActivity: number
}

const accentHex: Record<string, string> = {
  blue: '#6C8EEF',
  purple: '#A78BFA',
  red: '#F87171',
  emerald: '#34D399',
  green: '#34D399',
  amber: '#FBBF24',
  orange: '#FB923C',
  teal: '#2DD4BF',
  rose: '#F472B6',
  pink: '#F472B6',
  cyan: '#2DD4BF',
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function ProjectCard({ project }: { project: ProjectSummary }) {
  const { selectProject, setLaunchPrefilledProject, setLaunchOpen } = useCommandCenterStore()

  const handleLaunch = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLaunchPrefilledProject(project.path)
    setLaunchOpen(true)
  }

  return (
    <div
      onClick={() => selectProject(project.path)}
      className="bg-surface-2 hover:bg-surface-3 border-l-4 rounded-lg p-4 cursor-pointer transition-colors"
      style={{ borderLeftColor: accentHex[project.color] || accentHex.blue }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/90">{project.name}</span>
        <button
          onClick={handleLaunch}
          className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          title="New task for this project"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex gap-2 mt-2">
        {project.workingCount > 0 && (
          <span className="bg-accent-emerald/15 text-accent-emerald px-1.5 py-0.5 rounded-full text-[10px] font-medium">
            {project.workingCount} working
          </span>
        )}
        {project.awaitingCount > 0 && (
          <span className="bg-accent-amber/15 text-accent-amber px-1.5 py-0.5 rounded-full text-[10px] font-medium">
            {project.awaitingCount} awaiting
          </span>
        )}
        {project.erroredCount > 0 && (
          <span className="bg-accent-red/15 text-accent-red px-1.5 py-0.5 rounded-full text-[10px] font-medium">
            {project.erroredCount} errored
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-white/40 truncate">{project.lastPrompt || 'No prompt'}</p>
      <p className="mt-2 text-[10px] text-white/25 font-mono">{relativeTime(project.lastActivity)}</p>
    </div>
  )
}
