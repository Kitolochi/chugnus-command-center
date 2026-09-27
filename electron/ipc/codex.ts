import { ipcMain, dialog, type BrowserWindow } from 'electron'
import { initCodexSessions, getCodexSessions, getCodexStatus, startCodexTurn, stopCodexSession, archiveCodexSession, importCodexSession, onCodexComplete } from '../codex-sessions'
import { upsertKnownProject, incrementDailyPrompts, getMemorySettings } from '../database'
import { discoverCodexHistory } from '../codex-history'
import { extractMemoriesFromCli, getRelevantMemories } from '../memory'
import { isLLMConfigured } from '../llm'
import type { CodexTurnOptions } from '../../src/types/codex'

export function registerCodexHandlers(window: BrowserWindow) {
  initCodexSessions(window)
  onCodexComplete(async session => {
    if (getMemorySettings().autoGenerate && isLLMConfigured() && session.threadId) await extractMemoriesFromCli(`codex:${session.threadId}`, true)
  })
  ipcMain.handle('codex:status', () => getCodexStatus())
  ipcMain.handle('codex:sessions', () => getCodexSessions())
  ipcMain.handle('codex:history', () => discoverCodexHistory())
  ipcMain.handle('codex:import', (_, threadId: string) => importCodexSession(threadId))
  ipcMain.handle('codex:extract-memories', async (_, threadId: string) => {
    if (!isLLMConfigured()) throw new Error('Configure an AI provider in Settings to extract memories. Session history is saved regardless.')
    return extractMemoriesFromCli(`codex:${threadId}`, true)
  })
  ipcMain.handle('codex:turn', (_, opts: CodexTurnOptions) => {
    const previous = opts.sessionId ? getCodexSessions().find(s => s.id === opts.sessionId)?.messages || [] : []
    const memories = getRelevantMemories(`${opts.projectPath}\n${opts.prompt}`, previous)
    const session = startCodexTurn(opts, memories)
    upsertKnownProject(session.projectPath)
    incrementDailyPrompts()
    return session
  })
  ipcMain.handle('codex:stop', (_, id: string) => stopCodexSession(id))
  ipcMain.handle('codex:archive', (_, id: string, archived: boolean) => archiveCodexSession(id, archived))
  ipcMain.handle('codex:pick-files', async () => {
    const result = await dialog.showOpenDialog(window, { properties: ['openFile', 'multiSelections'] })
    return result.canceled ? [] : result.filePaths
  })
}
