import { ipcMain } from 'electron'
import { getTelegramSettings, saveTelegramSettings } from '../database'
import { startTelegramBot, stopTelegramBot, getTelegramBotStatus } from '../telegram-bot'
import type { TelegramSettings } from '../database'

export function registerTelegramHandlers() {
  ipcMain.handle('get-telegram-settings', () => {
    return getTelegramSettings()
  })

  ipcMain.handle('save-telegram-settings', (_e, updates: Partial<TelegramSettings>) => {
    const saved = saveTelegramSettings(updates)

    // Auto-start/stop bot based on enabled flag
    if (saved.enabled && saved.botToken && saved.authorizedChatId) {
      startTelegramBot(saved)
    } else {
      stopTelegramBot()
    }

    return saved
  })

  ipcMain.handle('get-telegram-status', () => {
    return getTelegramBotStatus()
  })

  ipcMain.handle('telegram-test-connection', () => {
    const settings = getTelegramSettings()
    if (!settings.botToken || !settings.authorizedChatId) {
      return { success: false, error: 'Bot token and chat ID required' }
    }
    return startTelegramBot(settings)
  })
}
