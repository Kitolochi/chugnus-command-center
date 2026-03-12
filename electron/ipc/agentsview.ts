import { ipcMain } from 'electron'
import http from 'http'
import path from 'path'
import fs from 'fs'
import { startAVProcess, stopAVProcess, getAVProcessStatus } from '../agentsview-process'

const AV_BASE = 'http://127.0.0.1:8090/api/v1'
const AV_ORIGIN = 'http://127.0.0.1:8090'

/** GET that returns raw text (not JSON-parsed) — for HTML export etc. */
function avFetchRaw(path: string, timeout = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${AV_BASE}/${path}`)
    const req = http.get(url, { timeout }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('AgentsView request timed out')) })
  })
}

function avFetch(path: string, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${AV_BASE}/${path}`)
    const req = http.get(url, { timeout }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error(`Invalid JSON from AgentsView: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('AgentsView request timed out')) })
  })
}

/** POST to AgentsView with SSE streaming — collects events until stream ends */
function avPost(path: string, body?: any, timeout = 60000): Promise<{ events: any[] }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${AV_BASE}/${path}`)
    const bodyStr = body ? JSON.stringify(body) : ''
    const req = http.request(url, {
      method: 'POST',
      timeout,
      headers: {
        'Origin': AV_ORIGIN,
        ...(bodyStr ? { 'Content-Type': 'application/json' } : {}),
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errData = ''
        res.on('data', (chunk) => { errData += chunk })
        res.on('end', () => reject(new Error(errData || `HTTP ${res.statusCode}`)))
        return
      }
      const events: any[] = []
      let buffer = ''
      res.on('data', (chunk) => {
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { events.push(JSON.parse(line.slice(6))) } catch {}
          }
        }
      })
      res.on('end', () => resolve({ events }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('AgentsView POST timed out')) })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

export function registerAgentsViewHandlers() {
  ipcMain.handle('av-ping', async () => {
    try {
      await avFetch('stats', 3000)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('av-get-stats', () => avFetch('stats'))
  ipcMain.handle('av-get-summary', (_, days?: number) =>
    avFetch(days ? `analytics/summary?days=${days}` : 'analytics/summary'))
  ipcMain.handle('av-get-tools', (_, days?: number) =>
    avFetch(days ? `analytics/tools?days=${days}` : 'analytics/tools'))
  ipcMain.handle('av-get-velocity', (_, days?: number) =>
    avFetch(days ? `analytics/velocity?days=${days}` : 'analytics/velocity'))
  ipcMain.handle('av-get-heatmap', () => avFetch('analytics/heatmap'))
  ipcMain.handle('av-get-projects', () => avFetch('analytics/projects'))
  ipcMain.handle('av-get-sessions', () => avFetch('analytics/sessions'))
  ipcMain.handle('av-get-top-sessions', () => avFetch('analytics/top-sessions'))
  ipcMain.handle('av-get-session-list', (_, opts?: { limit?: number; project?: string; search?: string }) => {
    const params = new URLSearchParams()
    params.set('limit', String(opts?.limit ?? 50))
    params.set('sort', 'updated_at')
    params.set('order', 'desc')
    if (opts?.project) params.set('project', opts.project)
    if (opts?.search) params.set('search', opts.search)
    return avFetch(`sessions?${params}`)
  })
  ipcMain.handle('av-get-session-detail', (_, id: string) => avFetch(`sessions/${id}`))
  ipcMain.handle('av-get-session-messages', (_, id: string, limit?: number) =>
    avFetch(`sessions/${id}/messages?limit=${limit ?? 100}`))
  ipcMain.handle('av-get-insights', () => avFetch('insights'))
  ipcMain.handle('av-get-sync-status', () => avFetch('sync/status'))

  // Search & analytics
  ipcMain.handle('av-search', (_, q: string, limit?: number) =>
    avFetch(`search?q=${encodeURIComponent(q)}&limit=${limit ?? 20}`))
  ipcMain.handle('av-get-activity', (_, days?: number) =>
    avFetch(days ? `analytics/activity?days=${days}` : 'analytics/activity'))
  ipcMain.handle('av-get-hour-of-week', () => avFetch('analytics/hour-of-week'))
  ipcMain.handle('av-get-session-children', (_, id: string) =>
    avFetch(`sessions/${id}/children`))
  ipcMain.handle('av-export-session', (_, id: string) =>
    avFetchRaw(`sessions/${id}/export`))

  // Write operations
  ipcMain.handle('av-sync', (_, full?: boolean) =>
    avPost('sync', full ? { full: true } : undefined, 120000))
  ipcMain.handle('av-generate-insights', async (_, type: string, dateFrom: string, dateTo: string) => {
    const result = await avPost('insights/generate', { type, date_from: dateFrom, date_to: dateTo }, 60000)

    // Save to context library so knowledge pack can index it
    try {
      const insights = await avFetch('insights') as any[]
      if (insights && insights.length > 0) {
        const latest = insights[insights.length - 1]
        if (latest?.content) {
          const homeDir = process.env.USERPROFILE || process.env.HOME || ''
          const insightsDir = path.join(homeDir, '.claude', 'memory', 'insights')
          if (!fs.existsSync(insightsDir)) fs.mkdirSync(insightsDir, { recursive: true })
          const dateSlug = `${dateFrom}${dateTo !== dateFrom ? '_to_' + dateTo : ''}`
          const filename = `${type}-${dateSlug}.md`
          const header = `# ${type === 'daily_activity' ? 'Activity Summary' : 'Agent Analysis'} — ${dateFrom}${dateTo !== dateFrom ? ' to ' + dateTo : ''}\n\n`
          fs.writeFileSync(path.join(insightsDir, filename), header + latest.content, 'utf-8')
        }
      }
    } catch { /* don't fail the main operation if context save fails */ }

    return result
  })

  // Process management
  ipcMain.handle('av-process-start', async () => {
    startAVProcess()
    // Poll until the server responds or 5s elapses
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 500))
      try {
        await avFetch('stats', 2000)
        return true
      } catch {}
    }
    return false
  })

  ipcMain.handle('av-process-stop', () => {
    stopAVProcess()
    return true
  })

  ipcMain.handle('av-process-status', () => {
    return getAVProcessStatus()
  })
}
