import { pasteClipboardImages, savePastedImage } from '../codex-clipboard'
import { getCodexModelSettings, resolveCodexSelection } from '../codex-models'
import { ipcMain, dialog, type BrowserWindow } from 'electron'
import { controlCodexQueue, onCodexQueuedTurn, initCodexSessions, getCodexSessions, getCodexStatus, startCodexTurn, stopCodexSession, archiveCodexSession, importCodexSession, onCodexComplete } from '../codex-sessions'
import { upsertKnownProject, incrementDailyPrompts, getMemorySettings } from '../database'
import { discoverCodexHistory, readCodexTranscript } from '../codex-history'
import { extractMemoriesFromCli, getRelevantMemories } from '../memory'
import { isLLMConfigured } from '../llm'
import type { CodexTurnOptions } from '../../src/types/codex'

export function registerCodexHandlers(window: BrowserWindow) {
  initCodexSessions(window)
  ipcMain.handle('codex:paste-images', () => pasteClipboardImages())
  ipcMain.handle('codex:save-pasted-image', (_, bytes: Uint8Array) => savePastedImage(bytes))
  onCodexQueuedTurn(opts => {
    const previous = getCodexSessions().find(session => session.id === opts.sessionId)?.messages || []
    return startCodexTurn(opts, getRelevantMemories(`${opts.projectPath}\n${opts.prompt}`, previous), true)
  })
  ipcMain.handle('codex:queue', (_, id: string, action: 'resume' | 'remove', pendingId?: string) => controlCodexQueue(id, action, pendingId))
  onCodexComplete(async session => {
    if (getMemorySettings().autoGenerate && isLLMConfigured() && session.threadId) await extractMemoriesFromCli(`codex:${session.threadId}`, true)
  })
  ipcMain.handle('codex:model-settings', (_, projectPath?: string) => getCodexModelSettings(projectPath))
  ipcMain.handle('codex:status', () => getCodexStatus())
  ipcMain.handle('codex:sessions', () => getCodexSessions())
  ipcMain.handle('codex:transcript', async (_, threadId: string) => (await readCodexTranscript(threadId)).messages)
  ipcMain.handle('codex:history', () => discoverCodexHistory())
  ipcMain.handle('codex:import', (_, threadId: string) => importCodexSession(threadId))
  ipcMain.handle('codex:extract-memories', async (_, threadId: string) => {
    if (!isLLMConfigured()) throw new Error('Configure an AI provider in Settings to extract memories. Session history is saved regardless.')
    return extractMemoriesFromCli(`codex:${threadId}`, true)
  })
  ipcMain.handle('codex:turn', async (_, opts: CodexTurnOptions) => {
    const projectPath = (opts.sessionId && getCodexSessions().find(s => s.id === opts.sessionId)?.projectPath) || opts.projectPath
    const settings = await getCodexModelSettings(projectPath)
    const selection = resolveCodexSelection(settings, opts.model, opts.effort)
    const previous = opts.sessionId ? getCodexSessions().find(s => s.id === opts.sessionId)?.messages || [] : []
    const memories = getRelevantMemories(`${opts.projectPath}\n${opts.prompt}`, previous)
    const session = startCodexTurn({ ...opts, ...selection }, memories)
    upsertKnownProject(session.projectPath)
    incrementDailyPrompts()
    return session
  })
  ipcMain.handle('codex:stop', (_, id: string) => stopCodexSession(id))
  ipcMain.handle('codex:archive', (_, id: string, archived: boolean, disposition?: 'parked' | 'completed' | 'killed') => archiveCodexSession(id, archived, disposition))
  ipcMain.handle('codex:pick-files', async () => {
    const result = await dialog.showOpenDialog(window, { properties: ['openFile', 'multiSelections'] })
    return result.canceled ? [] : result.filePaths
  })
}
