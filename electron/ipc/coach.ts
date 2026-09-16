import { ipcMain } from 'electron'
import { toggleCoach, saveTipToMemory, clearDay } from '../usage-coach'
import type { CoachTip } from '../../src/types'

export function registerCoachHandlers() {
  ipcMain.handle('coach:toggle', (_e, enabled: boolean) => {
    toggleCoach(enabled)
  })

  ipcMain.handle('coach:save-tip', (_e, tip: CoachTip) => {
    saveTipToMemory(tip)
  })

  ipcMain.handle('coach:clear-day', () => {
    clearDay()
  })
}
