const MAX_RECORDING_MS = 12000  // auto-stop after 12 seconds

let mediaStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let maxTimer: ReturnType<typeof setTimeout> | null = null
// Per-session chunks array — prevents cross-contamination between recordings
let sessionChunks: Blob[] | null = null

/** Clean up all audio resources */
function cleanup(): void {
  if (maxTimer) { clearTimeout(maxTimer); maxTimer = null }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop() } catch {}
  }
  mediaRecorder = null
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }
  sessionChunks = null
}

export async function startRecording(deviceId?: string, onMaxDuration?: () => void): Promise<void> {
  cleanup()

  // Fresh chunks array for this recording session
  const chunks: Blob[] = []
  sessionChunks = chunks

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  })

  mediaRecorder = new MediaRecorder(mediaStream)
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  mediaRecorder.start(250)

  // Auto-stop after max duration
  if (onMaxDuration) {
    maxTimer = setTimeout(() => {
      maxTimer = null
      onMaxDuration()
    }, MAX_RECORDING_MS)
  }
}

/** Stop recording and return the raw webm audio blob as ArrayBuffer. */
export async function stopRecording(): Promise<ArrayBuffer> {
  if (maxTimer) { clearTimeout(maxTimer); maxTimer = null }

  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      cleanup()
      reject(new Error('No active recording'))
      return
    }

    // Capture the chunks array for THIS session (closure)
    const chunks = sessionChunks
    const recorder = mediaRecorder

    recorder.onstop = async () => {
      try {
        if (!chunks || chunks.length === 0) {
          cleanup()
          reject(new Error('No audio data captured'))
          return
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        const arrayBuffer = await blob.arrayBuffer()
        cleanup()
        resolve(arrayBuffer)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    // Stop recorder first, let onstop handle cleanup (including stream tracks)
    recorder.stop()
  })
}

export function isRecordingActive(): boolean {
  return mediaRecorder !== null && mediaRecorder.state === 'recording'
}
