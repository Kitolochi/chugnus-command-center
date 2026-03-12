import { ipcMain, BrowserWindow } from 'electron'
import {
  getSocialConnections,
  createSocialConnection,
  updateSocialConnection,
  deleteSocialConnection,
} from '../database'
import { startChatGPTOAuth, refreshChatGPTTokens, decodeJWTPayload } from '../social/chatgpt'

export function registerSocialHandlers(_mainWindow: BrowserWindow) {
  // ChatGPT OAuth: start
  ipcMain.handle('chatgpt-oauth-start', async () => {
    const result = await startChatGPTOAuth()
    const expiresAt = new Date(Date.now() + result.tokens.expires_in * 1000).toISOString()

    // Remove any existing chatgpt connection
    const existing = getSocialConnections().find(c => c.provider === 'chatgpt')
    if (existing) deleteSocialConnection(existing.id)

    createSocialConnection({
      provider: 'chatgpt',
      accountId: result.profile.sub,
      accountName: result.profile.name,
      status: 'connected',
      lastSyncAt: null,
      credentials: JSON.stringify({
        access_token: result.tokens.access_token,
        refresh_token: result.tokens.refresh_token,
        id_token: result.tokens.id_token,
        expires_at: expiresAt,
        profile: result.profile,
      }),
    })

    return { connected: true, profile: result.profile }
  })

  // ChatGPT OAuth: disconnect
  ipcMain.handle('chatgpt-oauth-disconnect', () => {
    const conn = getSocialConnections().find(c => c.provider === 'chatgpt')
    if (conn) deleteSocialConnection(conn.id)
  })

  // ChatGPT OAuth: status
  ipcMain.handle('chatgpt-oauth-status', () => {
    const conn = getSocialConnections().find(c => c.provider === 'chatgpt')
    if (!conn || conn.status !== 'connected') return { connected: false }
    const creds = JSON.parse(conn.credentials)
    return {
      connected: true,
      profile: creds.profile,
      expiresAt: creds.expires_at,
    }
  })

  // ChatGPT OAuth: refresh
  ipcMain.handle('chatgpt-oauth-refresh', async () => {
    const conn = getSocialConnections().find(c => c.provider === 'chatgpt')
    if (!conn) throw new Error('No ChatGPT connection found')
    const creds = JSON.parse(conn.credentials)
    const tokens = await refreshChatGPTTokens(creds.refresh_token)
    const profile = decodeJWTPayload(tokens.id_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    updateSocialConnection(conn.id, {
      credentials: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
        expires_at: expiresAt,
        profile: {
          sub: profile.sub || '',
          name: profile.name || profile.email || 'ChatGPT User',
          email: profile.email || '',
        },
      }),
    })

    return { refreshed: true }
  })
}
