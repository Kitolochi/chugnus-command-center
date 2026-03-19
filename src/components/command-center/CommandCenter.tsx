import { useEffect, useRef, useState } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { Button, EmptyState } from '../ui'
import { Layers, Plus, RotateCcw } from 'lucide-react'
import PomodoroWidget from './PomodoroWidget'
import FocusCard from './FocusCard'
import CollapsedCard from './CollapsedCard'
import HistoryView from './HistoryView'
import CollabView from './CollabView'
import CodexChatView from './CodexChatView'

export default function CommandCenter() {
  const {
    queue, history, activeView, focusId,
    loadQueue, loadHistory, loadProjects, launch,
    setActiveView, setLaunchOpen, setFocusId,
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

  // Sort: awaiting_input first (FIFO), then errored, then working
  const sorted = [...queue].sort((a, b) => {
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

  return (
    <div className="p-6 pt-10 max-w-3xl mx-auto">
      {/* Pomodoro */}
      <div className="mb-4">
        <PomodoroWidget />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white/90 font-accent tracking-tight">Command Center</h1>
          {queue.length > 0 && (
            <div className="flex items-center gap-1 bg-surface-2 rounded-full px-2.5 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
              <span className="text-[10px] text-white/60 font-medium font-mono">{queue.length} active</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[10px] font-mono">
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
          <div className="bg-surface-2 rounded-full px-2.5 py-0.5">
            <span className="text-[10px] text-white/40 font-mono">{dailyPrompts} today</span>
          </div>
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
          <Button variant="primary" size="sm" onClick={() => setLaunchOpen(true)}>
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
        <>
        {/* Restore crashed sessions bar */}
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
        {queue.length === 0 && crashedSessions.length === 0 ? (
          <EmptyState
            icon={<Layers size={20} className="text-white/30" />}
            title="No active tasks"
            description="Launch a Claude CLI instance to get started."
            action={{ label: 'New Task', onClick: () => setLaunchOpen(true) }}
          />
        ) : queue.length > 0 ? (
          <div className="space-y-2">
            {focusItem && <FocusCard item={focusItem} />}
            {collapsed.map(item => (
              <CollapsedCard key={item.processId} item={item} onFocus={() => { setFocusId(item.processId); setUserPinned(true) }} />
            ))}
          </div>
        ) : null}
        </>
      ) : activeView === 'history' ? (
        <HistoryView />
      ) : null}

    </div>
  )
}
