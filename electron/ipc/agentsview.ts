import { ipcMain } from 'electron'
import {
  computeStats, computeSummary, computeTools, computeHeatmap,
  computeActivity, computeHourOfWeek, computeProjects, computeSessions,
  computeTopSessions, getSessionList, getSessionDetail, getSessionMessages,
  searchSessions, getSessionChildren, clearAnalyticsCache,
} from '../analytics'

export function registerAgentsViewHandlers() {
  // Ping always succeeds — native engine is always "online"
  ipcMain.handle('av-ping', async () => true)

  ipcMain.handle('av-get-stats', () => computeStats())
  ipcMain.handle('av-get-summary', (_, days?: number) => computeSummary(days))
  ipcMain.handle('av-get-tools', (_, days?: number) => computeTools(days))
  ipcMain.handle('av-get-heatmap', () => computeHeatmap())
  ipcMain.handle('av-get-projects', () => computeProjects())
  ipcMain.handle('av-get-sessions', () => computeSessions())
  ipcMain.handle('av-get-top-sessions', () => computeTopSessions())
  ipcMain.handle('av-get-session-list', (_, opts?: { limit?: number; project?: string; search?: string }) =>
    getSessionList(opts))
  ipcMain.handle('av-get-session-detail', (_, id: string) => getSessionDetail(id))
  ipcMain.handle('av-get-session-messages', (_, id: string, limit?: number) =>
    getSessionMessages(id, limit))

  // Search
  ipcMain.handle('av-search', (_, q: string, limit?: number) => searchSessions(q, limit))
  ipcMain.handle('av-get-activity', (_, days?: number) => computeActivity(days))
  ipcMain.handle('av-get-hour-of-week', () => computeHourOfWeek())
  ipcMain.handle('av-get-session-children', (_, id: string) => getSessionChildren(id))

  // Refresh: clear cache and re-compute
  ipcMain.handle('av-refresh', () => {
    clearAnalyticsCache()
    return true
  })
}
