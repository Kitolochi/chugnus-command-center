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
  codexChat,
  readProjectTree,
  readFileContent,
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

  // Collab handlers
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

  // Codex (GPT 5.4) chat handlers
  ipcMain.handle('codex:send', async (_, opts: { messages: { role: string; content: string }[]; projectPath?: string }) => {
    return codexChat(opts.messages)
  })

  ipcMain.handle('codex:read-tree', (_, opts: { projectPath: string }) => {
    return readProjectTree(opts.projectPath)
  })

  ipcMain.handle('codex:read-file', (_, opts: { filePath: string }) => {
    return readFileContent(opts.filePath)
  })
}
