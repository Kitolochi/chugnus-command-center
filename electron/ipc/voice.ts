import { BrowserWindow, globalShortcut, ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import { getHotkeySettings, saveHotkeySettings, getVoiceDeviceSettings, saveVoiceDeviceSettings } from '../database'

let whisperInstance: any = null
const MODEL_NAME = 'ggml-base.en.bin'
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}`

function getModelsDir(): string {
  const dir = path.join(app.getPath('userData'), 'models')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getModelPath(): string {
  return path.join(getModelsDir(), MODEL_NAME)
}

function isModelDownloaded(): boolean {
  return fs.existsSync(getModelPath())
}

async function initWhisper(): Promise<void> {
  if (whisperInstance) return
  if (!isModelDownloaded()) return

  try {
    const { whisper } = await import('whisper-node-addon')
    whisperInstance = whisper(getModelPath(), { language: 'en' })
    console.log('[voice] Whisper model loaded')
  } catch (err) {
    console.error('[voice] Failed to init whisper:', err)
    whisperInstance = null
  }
}

function downloadModel(mainWindow: BrowserWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    const modelPath = getModelPath()
    const tmpPath = modelPath + '.tmp'

    const makeRequest = (url: string) => {
      https.get(url, (response) => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            makeRequest(redirectUrl)
            return
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${response.statusCode}`))
          return
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedBytes = 0
        const file = fs.createWriteStream(tmpPath)

        response.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length
          file.write(chunk)
          if (totalBytes > 0) {
            const pct = Math.round((downloadedBytes / totalBytes) * 100)
            safeSend(mainWindow, 'voice:model-progress', pct)
          }
        })

        response.on('end', () => {
          file.end(() => {
            fs.renameSync(tmpPath, modelPath)
            console.log('[voice] Model download complete')
            resolve()
          })
        })

        response.on('error', (err) => {
          file.close()
          fs.unlinkSync(tmpPath)
          reject(err)
        })
      }).on('error', reject)
    }

    makeRequest(MODEL_URL)
  })
}

/** Safely send IPC to renderer — avoids "Render frame was disposed" crash */
function safeSend(win: BrowserWindow, channel: string, ...args: any[]) {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  } catch {}
}

export function registerVoiceHandlers(mainWindow: BrowserWindow) {
  // Check model status
  ipcMain.handle('voice:model-status', () => {
    return { downloaded: isModelDownloaded(), ready: !!whisperInstance }
  })

  // Download model
  ipcMain.handle('voice:download-model', async () => {
    if (isModelDownloaded()) {
      await initWhisper()
      return { success: true }
    }
    try {
      await downloadModel(mainWindow)
      await initWhisper()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Transcribe PCM audio buffer
  ipcMain.handle('voice:transcribe', async (_event, pcmBuffer: Buffer) => {
    if (!whisperInstance) {
      await initWhisper()
    }
    if (!whisperInstance) {
      return { text: '', error: 'Whisper model not loaded' }
    }
    try {
      // whisper-node-addon expects Int16Array (PCM 16-bit mono 16kHz)
      const int16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2)
      const result = await whisperInstance.transcribe(int16)
      const text = Array.isArray(result)
        ? result.map((s: any) => s.text || s).join(' ').trim()
        : (typeof result === 'string' ? result.trim() : '')
      return { text }
    } catch (err: any) {
      console.error('[voice] Transcription error:', err)
      return { text: '', error: err.message }
    }
  })

  // Voice device settings
  ipcMain.handle('voice:get-device-settings', () => {
    return getVoiceDeviceSettings()
  })

  ipcMain.handle('voice:save-device-settings', (_, updates: { inputDeviceId?: string; outputDeviceId?: string }) => {
    return saveVoiceDeviceSettings(updates)
  })

  // Hotkey settings CRUD
  ipcMain.handle('hotkey:get-settings', () => {
    return getHotkeySettings()
  })

  ipcMain.handle('hotkey:save-settings', (_, updates: { voiceToggle?: string }) => {
    const oldSettings = getHotkeySettings()

    // Unregister old hotkey
    try { globalShortcut.unregister(oldSettings.voiceToggle) } catch {}

    const newSettings = saveHotkeySettings(updates)

    // Register new hotkey
    const success = globalShortcut.register(newSettings.voiceToggle, () => {
      safeSend(mainWindow, 'voice:hotkey-pressed')
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    })

    if (!success) {
      // Revert on failure
      saveHotkeySettings({ voiceToggle: oldSettings.voiceToggle })
      try {
        globalShortcut.register(oldSettings.voiceToggle, () => {
          safeSend(mainWindow, 'voice:hotkey-pressed')
          if (!mainWindow.isVisible()) mainWindow.show()
          mainWindow.focus()
        })
      } catch {}
      throw new Error('Failed to register hotkey — it may conflict with another app')
    }

    return newSettings
  })

  // Register global hotkey for voice toggle from saved settings
  app.whenReady().then(() => {
    try {
      const settings = getHotkeySettings()
      globalShortcut.register(settings.voiceToggle, () => {
        safeSend(mainWindow, 'voice:hotkey-pressed')
        if (!mainWindow.isVisible()) mainWindow.show()
        mainWindow.focus()
      })
    } catch (err) {
      console.error('[voice] Failed to register hotkey:', err)
    }
  })

  // Pre-load whisper if model already downloaded
  if (isModelDownloaded()) {
    setTimeout(() => initWhisper(), 3000)
  }
}
