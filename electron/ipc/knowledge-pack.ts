import { ipcMain, BrowserWindow } from 'electron'
import { getKnowledgePacks, compressKnowledgeNative, auditCompression, compressSingleFile, compressFolder, testEmbeddingSimilarity, listContextFiles } from '../knowledge-pack'
import { getMemoryHealth, autoPrune, startHealthMonitor, stopHealthMonitor } from '../memory-health'

export function registerKnowledgePackHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle('get-knowledge-packs', () => {
    return getKnowledgePacks()
  })

  ipcMain.handle('compress-knowledge', async () => {
    const pack = await compressKnowledgeNative((progress) => {
      mainWindow.webContents.send('compression-progress', progress)
    })
    return pack
  })

  ipcMain.handle('audit-compression', async () => {
    const audit = await auditCompression((progress) => {
      mainWindow.webContents.send('compression-progress', progress)
    })
    return audit
  })

  // Lab tools
  ipcMain.handle('compress-single-file', async (_, relativePath: string) => {
    const result = await compressSingleFile(relativePath, (progress) => {
      mainWindow.webContents.send('compression-progress', progress)
    })
    return result
  })

  ipcMain.handle('test-embedding-similarity', async (_, textA: string, textB: string) => {
    return testEmbeddingSimilarity(textA, textB)
  })

  ipcMain.handle('compress-folder', async (_, folder: string) => {
    const result = await compressFolder(folder, (progress) => {
      mainWindow.webContents.send('compression-progress', progress)
    })
    return result
  })

  ipcMain.handle('list-context-files', () => {
    return listContextFiles()
  })

  ipcMain.handle('get-memory-health', () => {
    return getMemoryHealth()
  })

  ipcMain.handle('auto-prune-memories', () => {
    return autoPrune()
  })

  ipcMain.handle('start-health-monitor', (_, intervalMs: number) => {
    startHealthMonitor(intervalMs || 60000, (health) => {
      mainWindow.webContents.send('memory-health-update', health)
    })
  })

  ipcMain.handle('stop-health-monitor', () => {
    stopHealthMonitor()
  })
}
