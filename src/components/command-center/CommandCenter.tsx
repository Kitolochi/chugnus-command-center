import { useEffect, useRef, useState } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { Button, EmptyState } from '../ui'
import { ArrowLeft, Layers, Plus, RotateCcw } from 'lucide-react'
import PomodoroWidget from './PomodoroWidget'
import FocusCard from './FocusCard'
import CollapsedCard from './CollapsedCard'
import HistoryView from './HistoryView'
import CollabView from './CollabView'
import CodexChatView from './CodexChatView'
import { CoachStatusBadge, CoachPanel } from '../coach'
import ProjectsOverview from './ProjectsOverview'

export default function CommandCenter() {
  const {
    queue, history, activeView, focusId,
    selectedProject,
    loadQueue, loadHistory, loadProjects, launch,
    setActiveView, setLaunchOpen, setFocusId,
    deselectProject, setLaunchPrefilledProject,
  } = useCommandCenterStore()

  const [restoreDismissed, setRestoreDismissed] = useState(false)
  const [crashedIds, setCrashedIds] = useState<string[]>([])
  const [dailyPrompts, setDailyPrompts] = useState(0)
  const [userPinned, setUserPinned] = useState(false)

  const refreshDailyPrompts = () => {
    window.electronAPI.ccGetDailyPrompts().then(d => setDailyPrompts(d.count))
  }

  useEffect(() => {
    loadQueue()
    loadProjects()
    loadHistory()
    refreshDailyPrompts()
    window.electronAPI.ccGetCrashedIds().then(setCrashedIds)
    const unsub = window.electronAPI.onCCQueueUpdate((q) => {
      useCommandCenterStore.getState().updateQueue(q)
      refreshDailyPrompts()
    })
    return unsub
  }, [])

  // Clear pin when pinned item leaves queue or user responded (was awaiting, now working)
  const prevStatusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!userPinned || !focusId) return
    const pinned = queue.find(q => q.processId === focusId)
    if (!pinned) {
      setUserPinned(false)
    } else if (prevStatusRef.current === 'awaiting_input' && pinned.status === 'working') {
      // User just responded — release pin so next awaiting card auto-promotes
      setUserPinned(false)
    }
    prevStatusRef.current = pinned?.status ?? null
  }, [queue, focusId, userPinned])

  // Only show sessions that were marked crashed during THIS startup
  const crashedSessions = restoreDismissed ? [] : history.filter(e => crashedIds.includes(e.id))

  const handleRestoreAll = async () => {
    for (const entry of crashedSessions) {
      try {
        await launch(entry.projectPath, 'Continue where we left off.', { resumeSessionId: entry.sessionId })
      } catch {}
    }
    setRestoreDismissed(true)
  }

  const awaitingCount = queue.filter(q => q.status === 'awaiting_input').length
  const workingCount = queue.filter(q => q.status === 'working').length
  const errorCount = queue.filter(q => q.status === 'errored').length

  // Project-scoped filtering
  const projectQueue = selectedProject
    ? queue.filter(q => q.projectPath === selectedProject)
    : queue

  const projectAwaitingCount = selectedProject
    ? projectQueue.filter(q => q.status === 'awaiting_input').length
    : awaitingCount
  const projectWorkingCount = selectedProject
    ? projectQueue.filter(q => q.status === 'working').length
    : workingCount
  const projectErrorCount = selectedProject
    ? projectQueue.filter(q => q.status === 'errored').length
    : errorCount

  // Sort: awaiting_input first (FIFO), then errored, then working
  const sorted = [...projectQueue].sort((a, b) => {
    const priority = { awaiting_input: 0, errored: 1, working: 2 }
    const pa = priority[a.status] ?? 3
    const pb = priority[b.status] ?? 3
    if (pa !== pb) return pa - pb
    return a.updatedAt - b.updatedAt
  })

  // Honor focusId — user clicks always win; don't interrupt current awaiting_input
  const focusedItem = focusId ? sorted.find(s => s.processId === focusId) : null
  const focusStillAwaiting = focusedItem?.status === 'awaiting_input' || focusedItem?.status === 'errored'
  const focusItem = (focusedItem && (userPinned || focusStillAwaiting)) ? focusedItem : sorted[0]
  const collapsed = sorted.filter(s => s.processId !== focusItem?.processId)

  const selectedProjectName = selectedProject
    ? (projectQueue[0]?.projectName || 'Project')
    : null

  const projectCrashedSessions = selectedProject
    ? crashedSessions.filter(s => s.projectPath === selectedProject)
    : crashedSessions

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-6 pt-10">
        <div className="max-w-3xl mx-auto">
          {/* Pomodoro */}
          <div className="mb-4">
            <PomodoroWidget />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {selectedProject ? (
                <>
                  <button
                    onClick={deselectProject}
                    className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white/90 transition-colors"
                  >
                    <ArrowLeft size={14} className="text-white/40" />
                    <span className="font-semibold font-accent tracking-tight">{selectedProjectName}</span>
                  </button>
                  {projectQueue.length > 0 && (
                    <div className="flex items-center gap-1 bg-surface-2 rounded-full px-2.5 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
                      <span className="text-[10px] text-white/60 font-medium font-mono">{projectQueue.length} active</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h1 className="text-sm font-semibold text-white/90 font-accent tracking-tight">Command Center</h1>
                  {queue.length > 0 && (
                    <div className="flex items-center gap-1 bg-surface-2 rounded-full px-2.5 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
                      <span className="text-[10px] text-white/60 font-medium font-mono">{queue.length} active</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center gap-2 text-[10px] font-mono">
                {projectAwaitingCount > 0 && (
                  <span className="text-accent-amber">{projectAwaitingCount} awaiting</span>
                )}
                {projectWorkingCount > 0 && (
                  <span className="text-accent-emerald">{projectWorkingCount} working</span>
                )}
                {projectErrorCount > 0 && (
                  <span className="text-accent-red">{projectErrorCount} errored</span>
                )}
              </div>
              {!selectedProject && (
                <div className="bg-surface-2 rounded-full px-2.5 py-0.5">
                  <span className="text-[10px] text-white/40 font-mono">{dailyPrompts} today</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-surface-2 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveView('queue')}
                  className={`px-2.5 py-1 text-[10px] font-accent tracking-wide rounded-md transition-all ${
                    activeView === 'queue'
                      ? 'bg-surface-4 text-white/90'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Queue
                </button>
                <button
                  onClick={() => setActiveView('history')}
                  className={`px-2.5 py-1 text-[10px] font-accent tracking-wide rounded-md transition-all ${
                    activeView === 'history'
                      ? 'bg-surface-4 text-white/90'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  History
                </button>
                <button
                  onClick={() => setActiveView('collab')}
                  className={`px-2.5 py-1 text-[10px] font-accent tracking-wide rounded-md transition-all ${
                    activeView === 'collab'
                      ? 'bg-surface-4 text-white/90'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Collab
                </button>
                <button
                  onClick={() => setActiveView('codex')}
                  className={`px-2.5 py-1 text-[10px] font-accent tracking-wide rounded-md transition-all ${
                    activeView === 'codex'
                      ? 'bg-surface-4 text-white/90'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Codex
                </button>
              </div>
              <CoachStatusBadge />
              <Button variant="primary" size="sm" onClick={() => {
                if (selectedProject) setLaunchPrefilledProject(selectedProject)
                setLaunchOpen(true)
              }}>
                <Plus size={12} /> New Task
              </Button>
            </div>
          </div>

          {/* Content */}
          {activeView === 'codex' ? (
            <CodexChatView />
          ) : activeView === 'collab' ? (
            <CollabView />
          ) : activeView === 'queue' ? (
            selectedProject ? (
              <>
                {projectCrashedSessions.length > 0 && (
                  <div className="flex items-center justify-between bg-accent-amber/5 border border-accent-amber/15 rounded-lg px-4 py-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <RotateCcw size={12} className="text-accent-amber" />
                      <span className="text-[11px] text-white/70">
                        {projectCrashedSessions.length} interrupted session{projectCrashedSessions.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <button onClick={() => setRestoreDismissed(true)} className="text-[10px] text-white/30 hover:text-white/50 transition-colors">
                      Dismiss
                    </button>
                  </div>
                )}
                {projectQueue.length === 0 ? (
                  <EmptyState
                    icon={<Layers size={20} className="text-white/30" />}
                    title="All tasks complete"
                    description="This project has no active tasks."
                    action={{ label: 'Back to Projects', onClick: deselectProject }}
                  />
                ) : (
                  <div className="space-y-2">
                    {focusItem && <FocusCard item={focusItem} />}
                    {collapsed.map(item => (
                      <CollapsedCard key={item.processId} item={item} onFocus={() => { setFocusId(item.processId); setUserPinned(true) }} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {crashedSessions.length > 0 && (
                  <div className="flex items-center justify-between bg-accent-amber/5 border border-accent-amber/15 rounded-lg px-4 py-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <RotateCcw size={12} className="text-accent-amber" />
                      <span className="text-[11px] text-white/70">
                        {crashedSessions.length} session{crashedSessions.length > 1 ? 's were' : ' was'} interrupted
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setRestoreDismissed(true)} className="text-[10px] text-white/30 hover:text-white/50 transition-colors">
                        Dismiss
                      </button>
                      <button onClick={handleRestoreAll} className="px-3 py-1 rounded-md bg-accent-amber/15 text-accent-amber text-[10px] font-accent hover:bg-accent-amber/25 transition-all">
                        Restore all
                      </button>
                    </div>
                  </div>
                )}
                <ProjectsOverview />
              </>
            )
          ) : activeView === 'history' ? (
            <HistoryView />
          ) : null}

        </div>
      </div>
      <CoachPanel />
    </div>
  )
}
