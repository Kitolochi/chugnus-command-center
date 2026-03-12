import { ipcMain, BrowserWindow, dialog } from 'electron'
import { execSync } from 'child_process'
import {
  initCommandCenter,
  launchProcess,
  respondToProcess,
  dismissProcess,
  killProcess,
  getQueue,
} from '../command-center'
import {
  getCCHistory,
  addCCHistoryEntry,
  updateCCHistoryEntry,
  cleanupStaleCCHistory,
  getKnownProjects,
  upsertKnownProject,
  discoverProjects,
} from '../database'
import { getProjectDescription } from '../cli-logs'

export function registerCommandCenterHandlers(mainWindow: BrowserWindow) {
  initCommandCenter(mainWindow)
  cleanupStaleCCHistory()

  ipcMain.handle('cc:launch', async (_, opts: { projectPath: string; prompt: string; model?: string; maxBudget?: number; resumeSessionId?: string }) => {
    upsertKnownProject(opts.projectPath)
    const item = launchProcess(opts)

    // Save to history immediately on launch
    addCCHistoryEntry({
      id: item.processId,
      sessionId: opts.resumeSessionId,
      projectPath: item.projectPath,
      projectName: item.projectName,
      projectColor: item.projectColor,
      prompt: item.prompt,
      summary: 'Running...',
      status: 'running',
      filesChanged: [],
      costUsd: 0,
      turnCount: 0,
      startedAt: item.startedAt,
      completedAt: 0,
    })

    return item
  })

  ipcMain.handle('cc:respond', (_, opts: { processId: string; response: string }) => {
    respondToProcess(opts.processId, opts.response)
  })

  ipcMain.handle('cc:dismiss', (_, opts: { processId: string }) => {
    const item = dismissProcess(opts.processId)
    if (item) {
      let summary = item.resultText || 'Task completed'
      if (summary.length > 200) {
        const firstSentence = summary.match(/^[^.!?]+[.!?]/)
        summary = firstSentence ? firstSentence[0] + '...' : summary.slice(0, 200) + '...'
      }
      updateCCHistoryEntry(item.processId, {
        summary,
        status: 'completed',
        sessionId: item.sessionId,
        filesChanged: item.filesChanged,
        costUsd: item.costUsd,
        turnCount: item.turnCount,
        completedAt: Date.now(),
      })
    }
    return item
  })

  ipcMain.handle('cc:kill', (_, opts: { processId: string }) => {
    const item = killProcess(opts.processId)
    updateCCHistoryEntry(opts.processId, {
      status: 'killed',
      summary: 'Killed by user',
      sessionId: item?.sessionId,
      completedAt: Date.now(),
    })
  })

  ipcMain.handle('cc:get-queue', () => {
    return getQueue()
  })

  ipcMain.handle('cc:get-history', (_, opts?: { filter?: string; limit?: number; offset?: number }) => {
    return getCCHistory(opts?.filter, opts?.limit)
  })

  ipcMain.handle('cc:get-projects', () => {
    return discoverProjects()
  })

  ipcMain.handle('cc:get-project-description', (_, opts: { projectPath: string }) => {
    return getProjectDescription(opts.projectPath)
  })

  ipcMain.handle('cc:create-project', (_, opts: { name: string }) => {
    const safeName = opts.name.trim().replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').toLowerCase()
    if (!safeName) return null
    const projectPath = path.join(os.homedir(), safeName)
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true })
      try { execSync('git init', { cwd: projectPath, stdio: 'ignore' }) } catch {}
    }
    upsertKnownProject(projectPath)
    return { path: projectPath, name: safeName }
  })

  ipcMain.handle('cc:browse-project', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Directory',
    })
    if (result.canceled || !result.filePaths[0]) return null
    const projectPath = result.filePaths[0]
    upsertKnownProject(projectPath)
    return { path: projectPath, name: path.basename(projectPath) }
  })
}
