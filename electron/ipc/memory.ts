import { ipcMain, BrowserWindow } from 'electron'
import { getMemories, createMemory, updateMemory, deleteMemory, archiveMemory, pinMemory, getMemoryTopics, updateMemoryTopics, getMemorySettings, saveMemorySettings } from '../database'
import { extractMemoriesFromChat, extractMemoriesFromCli, extractMemoriesFromJournal, batchExtractMemories } from '../memory'

export function registerMemoryHandlers(_mainWindow: BrowserWindow) {
  ipcMain.handle('get-memories', () => {
    return getMemories()
  })

  ipcMain.handle('create-memory', (_, memory: any) => {
    return createMemory(memory)
  })

  ipcMain.handle('update-memory', (_, id: string, updates: any) => {
    return updateMemory(id, updates)
  })

  ipcMain.handle('delete-memory', (_, id: string) => {
    return deleteMemory(id)
  })

  ipcMain.handle('archive-memory', (_, id: string) => {
    return archiveMemory(id)
  })

  ipcMain.handle('pin-memory', (_, id: string) => {
    return pinMemory(id)
  })

  ipcMain.handle('get-memory-topics', () => {
    return getMemoryTopics()
  })

  ipcMain.handle('update-memory-topics', (_, topics: any[]) => {
    return updateMemoryTopics(topics)
  })

  ipcMain.handle('get-memory-settings', () => {
    return getMemorySettings()
  })

  ipcMain.handle('save-memory-settings', (_, settings: any) => {
    return saveMemorySettings(settings)
  })

  ipcMain.handle('extract-memories-from-chat', async (_, conversationId: string) => {
    return extractMemoriesFromChat(conversationId)
  })

  ipcMain.handle('extract-memories-from-cli', async (_, sessionId: string) => {
    return extractMemoriesFromCli(sessionId)
  })

  ipcMain.handle('extract-memories-from-journal', async (_, date: string) => {
    return extractMemoriesFromJournal(date)
  })

  ipcMain.handle('batch-extract-memories', async () => {
    return batchExtractMemories()
  })
}
