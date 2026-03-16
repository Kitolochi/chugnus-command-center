import { BrowserWindow, globalShortcut, ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'

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
            mainWindow.webContents.send('voice:model-progress', pct)
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

  // Register global hotkey for voice toggle
  app.whenReady().then(() => {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      mainWindow.webContents.send('voice:hotkey-pressed')
    })
  })

  // Pre-load whisper if model already downloaded
  if (isModelDownloaded()) {
    setTimeout(() => initWhisper(), 3000)
  }
}
