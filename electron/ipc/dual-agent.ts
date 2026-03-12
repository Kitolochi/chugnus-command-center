import { ipcMain, BrowserWindow } from 'electron'
import {
  initDualAgent,
  setOnSessionComplete,
  setGetHistoryEntry,
  startCollabSession,
  resumeCollabSession,
  respondToCollab,
  killCollabSession,
  getActiveCollabSession,
} from '../dual-agent'
import { addCollabHistoryEntry, getCollabHistory, getCollabHistoryEntry } from '../database'

export function registerDualAgentHandlers(mainWindow: BrowserWindow) {
  initDualAgent(mainWindow)

  setOnSessionComplete((session) => {
    addCollabHistoryEntry(session)
  })

  setGetHistoryEntry((id) => {
    return getCollabHistoryEntry(id)
  })

  ipcMain.handle('collab:start', (_, opts: { task: string; maxRounds?: number }) => {
    return startCollabSession(opts.task, opts.maxRounds)
  })

  ipcMain.handle('collab:resume', (_, opts: { sessionId: string; maxRounds?: number }) => {
    return resumeCollabSession(opts.sessionId, opts.maxRounds)
  })

  ipcMain.handle('collab:respond', (_, opts: { sessionId: string; response: string }) => {
    respondToCollab(opts.sessionId, opts.response)
  })

  ipcMain.handle('collab:kill', (_, opts: { sessionId: string }) => {
    killCollabSession(opts.sessionId)
  })

  ipcMain.handle('collab:get-session', () => {
    return getActiveCollabSession()
  })

  ipcMain.handle('collab:get-history', (_, opts?: { limit?: number }) => {
    return getCollabHistory(opts?.limit)
  })
}
