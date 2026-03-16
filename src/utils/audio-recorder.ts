const MAX_RECORDING_MS = 12000  // auto-stop after 12 seconds

let mediaStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let maxTimer: ReturnType<typeof setTimeout> | null = null

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
  audioChunks = []
}

export async function startRecording(deviceId?: string, onMaxDuration?: () => void): Promise<void> {
  cleanup()
  audioChunks = []

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
    if (e.data.size > 0) audioChunks.push(e.data)
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

/** Stop recording and return the raw webm audio blob as ArrayBuffer.
 *  No AudioContext is used — conversion to PCM happens in the main process via ffmpeg. */
export async function stopRecording(): Promise<ArrayBuffer> {
  if (maxTimer) { clearTimeout(maxTimer); maxTimer = null }

  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      cleanup()
      reject(new Error('No active recording'))
      return
    }

    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
        const arrayBuffer = await blob.arrayBuffer()
        cleanup()
        resolve(arrayBuffer)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    mediaRecorder.stop()
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
    }
  })
}

export function isRecordingActive(): boolean {
  return mediaRecorder !== null && mediaRecorder.state === 'recording'
}
