import { BrowserWindow } from 'electron'
import { SessionWatcher } from './watcher'
import { CoachAnalyzer } from './analyzer'
import { getCoachState, updateCoachState, createMemory } from '../database'
import type { CoachTip } from '../../src/types'

let watcher: SessionWatcher | null = null
let analyzer: CoachAnalyzer | null = null
let mainWindow: BrowserWindow | null = null
let currentTips: CoachTip[] = []

function safeSend(channel: string, ...args: any[]) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args)
    }
  } catch {}
}

export function initCoach(win: BrowserWindow) {
  mainWindow = win
  const state = getCoachState()

  analyzer = new CoachAnalyzer()
  analyzer.onTips = (tips, daySummary) => {
    currentTips = [...currentTips, ...tips]
    safeSend('coach:tips', currentTips)
    safeSend('coach:day-summary', daySummary)
  }
  analyzer.onStatusChange = (status, sessionCount) => {
    safeSend('coach:status', { status, sessionCount })
  }

  watcher = new SessionWatcher()
  watcher.onExchange = (exchange) => {
    analyzer?.enqueue(exchange)
  }

  // Let analyzer read the watcher's session count
  analyzer.setSessionCountFn(() => watcher?.sessions.size || 0)

  // Re-send tips on renderer reload
  win.webContents.on('did-finish-load', () => {
    safeSend('coach:tips', currentTips)
    safeSend('coach:status', {
      status: analyzer?.status || 'disabled',
      sessionCount: watcher?.sessions.size || 0,
    })
    const cs = getCoachState()
    safeSend('coach:day-summary', cs.dayAccumulator)
  })

  if (state.enabled) {
    watcher.start()
    analyzer.start()
  }
}

export function destroyCoach() {
  watcher?.stop()
  analyzer?.stop()
  watcher = null
  analyzer = null
}

export function toggleCoach(enabled: boolean) {
  updateCoachState({ enabled })
  if (enabled) {
    watcher?.start()
    analyzer?.start()
  } else {
    watcher?.stop()
    analyzer?.stop()
  }
}

export function saveTipToMemory(tip: CoachTip) {
  createMemory({
    title: `Coach: ${tip.title}`,
    content: `${tip.body}\n\nReference: ${tip.reference}`,
    topics: [tip.category, 'coach'],
    sourceType: 'coach',
    sourceId: tip.sessionId,
    sourcePreview: tip.reference.slice(0, 100),
    importance: tip.severity === 'warning' ? 3 : tip.severity === 'suggestion' ? 2 : 1,
    isPinned: false,
    isArchived: false,
    relatedMemoryIds: [],
  })
}

export function clearDay() {
  updateCoachState({
    dayAccumulator: '',
    globalTipsEmitted: [],
    lastResetDate: new Date().toISOString().split('T')[0],
  })
  currentTips = []
  safeSend('coach:tips', [])
  safeSend('coach:day-summary', '')
}

export function getCurrentTips(): CoachTip[] {
  return currentTips
}
