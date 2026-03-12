import { ipcMain, BrowserWindow } from 'electron'
import {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  setAgentStatus,
  getAgentIssues,
  getAgentIssue,
  createAgentIssue,
  updateAgentIssue,
  deleteAgentIssue,
  getHeartbeatRuns,
  getCostEvents,
  getAgentCostSummary,
  getAgentEvents,
} from '../database'
import {
  executeAgentHeartbeat,
  checkoutNextIssue,
  pollAgentSessions,
  completeRun,
} from '../agents'

let launchFn: ((opts: { prompt: string; cwd: string; env: NodeJS.ProcessEnv; title?: string; allowedTools?: string }) => void) | null = null

export function setAgentLaunchFn(fn: typeof launchFn) {
  launchFn = fn
}

export function registerAgentHandlers(mainWindow: BrowserWindow) {
  // --- Agents ---
  ipcMain.handle('get-agents', () => {
    return getAgents()
  })

  ipcMain.handle('get-agent', (_, id: string) => {
    return getAgent(id)
  })

  ipcMain.handle('create-agent', (_, data) => {
    const agent = createAgent(data)
    mainWindow?.webContents.send('agents-updated')
    return agent
  })

  ipcMain.handle('update-agent', (_, id: string, updates) => {
    const agent = updateAgent(id, updates)
    mainWindow?.webContents.send('agents-updated')
    return agent
  })

  ipcMain.handle('delete-agent', (_, id: string) => {
    deleteAgent(id)
    mainWindow?.webContents.send('agents-updated')
  })

  ipcMain.handle('set-agent-status', (_, id: string, status: string, lastError?: string) => {
    const agent = setAgentStatus(id, status as any, lastError)
    mainWindow?.webContents.send('agents-updated')
    return agent
  })

  // --- Agent Issues ---
  ipcMain.handle('get-agent-issues', (_, filters?: any) => {
    return getAgentIssues(filters)
  })

  ipcMain.handle('get-agent-issue', (_, id: string) => {
    return getAgentIssue(id)
  })

  ipcMain.handle('create-agent-issue', (_, data) => {
    const issue = createAgentIssue(data)
    mainWindow?.webContents.send('agents-updated')
    return issue
  })

  ipcMain.handle('update-agent-issue', (_, id: string, updates) => {
    const issue = updateAgentIssue(id, updates)
    mainWindow?.webContents.send('agents-updated')
    return issue
  })

  ipcMain.handle('delete-agent-issue', (_, id: string) => {
    deleteAgentIssue(id)
    mainWindow?.webContents.send('agents-updated')
  })

  // --- Heartbeat Runs ---
  ipcMain.handle('get-heartbeat-runs', (_, filters?: any) => {
    return getHeartbeatRuns(filters)
  })

  ipcMain.handle('run-agent-heartbeat', (_, agentId: string, issueId?: string) => {
    const agent = getAgent(agentId)
    if (!agent) return null

    let issue = issueId ? getAgentIssue(issueId) : null
    if (!issue && !issueId) {
      issue = checkoutNextIssue(agentId)
    }

    const run = executeAgentHeartbeat(agent, issue, 'manual', launchFn || undefined)
    mainWindow?.webContents.send('agents-updated')
    return run
  })

  ipcMain.handle('complete-heartbeat-run', (_, runId: string, updates: any) => {
    const run = completeRun(runId, updates)
    mainWindow?.webContents.send('agents-updated')
    return run
  })

  // --- Cost Events ---
  ipcMain.handle('get-cost-events', (_, filters?: any) => {
    return getCostEvents(filters)
  })

  ipcMain.handle('get-agent-cost-summary', (_, agentId: string) => {
    return getAgentCostSummary(agentId)
  })

  // --- Agent Events ---
  ipcMain.handle('get-agent-events', (_, filters?: any) => {
    return getAgentEvents(filters)
  })

  // --- Session Polling ---
  ipcMain.handle('poll-agent-sessions', async () => {
    await pollAgentSessions()
    return getHeartbeatRuns({ limit: 20 })
  })
}
