import { BrowserWindow, globalShortcut, ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import https from 'https'
import { execFileSync } from 'child_process'
import { getHotkeySettings, saveHotkeySettings, getVoiceDeviceSettings, saveVoiceDeviceSettings } from '../database'

let transcribeFn: ((opts: any) => Promise<any>) | null = null
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
  if (transcribeFn) return
  if (!isModelDownloaded()) return

  try {
    const { transcribe } = await import('whisper-node-addon')
    transcribeFn = transcribe
    console.log('[voice] Whisper module loaded')
  } catch (err) {
    console.error('[voice] Failed to load whisper module:', err)
    transcribeFn = null
  }
}

/** Write PCM Int16 buffer as a 16kHz mono WAV file */
function writeWav(pcmBuffer: Buffer, filePath: string): void {
  const sampleRate = 16000
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmBuffer.length

  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)        // fmt chunk size
  header.writeUInt16LE(1, 20)         // PCM format
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  fs.writeFileSync(filePath, Buffer.concat([header, pcmBuffer]))
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
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  } catch {}
}

export function registerVoiceHandlers(mainWindow: BrowserWindow) {
  // Check model status
  ipcMain.handle('voice:model-status', () => {
    return { downloaded: isModelDownloaded(), ready: isModelDownloaded() }
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

  // Transcribe raw audio (webm from MediaRecorder → ffmpeg convert → Whisper)
  ipcMain.handle('voice:transcribe', async (_event, audioBuffer: Buffer) => {
    if (!transcribeFn) {
      await initWhisper()
    }
    if (!transcribeFn) {
      return { text: '', error: 'Whisper module not loaded' }
    }
    const tmpDir = path.join(os.tmpdir(), 'chugnus-voice')
    fs.mkdirSync(tmpDir, { recursive: true })
    const ts = Date.now()
    const webmPath = path.join(tmpDir, `recording-${ts}.webm`)
    const wavPath = path.join(tmpDir, `recording-${ts}.wav`)
    try {
      // 1. Save raw webm from renderer
      fs.writeFileSync(webmPath, audioBuffer)
      console.log('[voice] Saved webm:', audioBuffer.length, 'bytes')

      // 2. Convert to 16kHz mono WAV via ffmpeg
      execFileSync('ffmpeg', [
        '-y', '-i', webmPath,
        '-ar', '16000', '-ac', '1', '-f', 'wav',
        wavPath,
      ], { timeout: 10000, stdio: 'pipe' })
      console.log('[voice] Converted to WAV')

      // 3. Transcribe with Whisper
      const result = await transcribeFn({
        model: getModelPath(),
        fname_inp: wavPath,
        language: 'en',
        no_prints: true,
      })
      // Result is array of segments: [{ start, end, speech }, ...]
      let text = ''
      if (Array.isArray(result)) {
        text = result.map((s: any) => s.speech || s.text || s).join(' ').trim()
      } else if (typeof result === 'string') {
        text = result.trim()
      }
      // Strip timestamp patterns like "[00:00:00.000 --> 00:00:03.000]"
      text = text.replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/g, '').trim()
      console.log('[voice] Transcribed:', text.slice(0, 100))
      return { text }
    } catch (err: any) {
      console.error('[voice] Transcription error:', err)
      return { text: '', error: err.message }
    } finally {
      try { fs.unlinkSync(webmPath) } catch {}
      try { fs.unlinkSync(wavPath) } catch {}
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

  // Pre-load whisper module if model already downloaded
  if (isModelDownloaded()) {
    setTimeout(() => initWhisper(), 3000)
  }
}
