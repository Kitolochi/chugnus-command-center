import { useEffect } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { Button, EmptyState } from '../ui'
import { Layers, Plus } from 'lucide-react'
import FocusCard from './FocusCard'
import CollapsedCard from './CollapsedCard'
import LaunchCard from './LaunchCard'
import HistoryView from './HistoryView'

export default function CommandCenter() {
  const {
    queue, activeView, launchOpen,
    loadQueue, loadProjects,
    setActiveView, setLaunchOpen,
  } = useCommandCenterStore()

  useEffect(() => {
    loadQueue()
    loadProjects()
    const unsub = window.electronAPI.onCCQueueUpdate((q) => {
      useCommandCenterStore.getState().updateQueue(q)
    })
    return unsub
  }, [])

  const awaitingCount = queue.filter(q => q.status === 'awaiting_input').length
  const workingCount = queue.filter(q => q.status === 'working').length
  const errorCount = queue.filter(q => q.status === 'errored').length

  // Sort: awaiting_input first (FIFO), then errored, then working
  const sorted = [...queue].sort((a, b) => {
    const priority = { awaiting_input: 0, errored: 1, working: 2 }
    const pa = priority[a.status] ?? 3
    const pb = priority[b.status] ?? 3
    if (pa !== pb) return pa - pb
    return a.updatedAt - b.updatedAt
  })

  const focusItem = sorted[0]
  const collapsed = sorted.slice(1)

  return (
    <div className="p-6 pt-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white/90">Command Center</h1>
          {queue.length > 0 && (
            <div className="flex items-center gap-1 bg-surface-2 rounded-full px-2.5 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
              <span className="text-[10px] text-white/60 font-medium">{queue.length} active</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[10px]">
            {awaitingCount > 0 && (
              <span className="text-accent-amber">{awaitingCount} awaiting</span>
            )}
            {workingCount > 0 && (
              <span className="text-accent-emerald">{workingCount} working</span>
            )}
            {errorCount > 0 && (
              <span className="text-accent-red">{errorCount} errored</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-2 rounded-lg p-0.5">
            <button
              onClick={() => setActiveView('queue')}
              className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
                activeView === 'queue'
                  ? 'bg-surface-4 text-white/90'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Queue
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
                activeView === 'history'
                  ? 'bg-surface-4 text-white/90'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              History
            </button>
          </div>
          <Button variant="primary" size="sm" onClick={() => setLaunchOpen(true)}>
            <Plus size={12} /> New Task
          </Button>
        </div>
      </div>

      {/* Content */}
      {activeView === 'queue' ? (
        queue.length === 0 ? (
          <EmptyState
            icon={<Layers size={20} className="text-white/30" />}
            title="No active tasks"
            description="Launch a Claude CLI instance to get started."
            action={{ label: 'New Task', onClick: () => setLaunchOpen(true) }}
          />
        ) : (
          <div className="space-y-2">
            {focusItem && <FocusCard item={focusItem} />}
            {collapsed.map(item => (
              <CollapsedCard key={item.processId} item={item} />
            ))}
          </div>
        )
      ) : (
        <HistoryView />
      )}

      {/* Launch Modal */}
      {launchOpen && <LaunchCard />}
    </div>
  )
}
