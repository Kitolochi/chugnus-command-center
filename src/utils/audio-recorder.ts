const TARGET_SAMPLE_RATE = 16000
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

        // Decode audio blob to PCM using AudioContext (offline, safe)
        const decodeCtx = new AudioContext()
        const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer)
        await decodeCtx.close()

        const rawPcm = audioBuffer.getChannelData(0)
        const nativeSampleRate = audioBuffer.sampleRate

        // Downsample to 16kHz for Whisper
        const resampled = downsample(rawPcm, nativeSampleRate, TARGET_SAMPLE_RATE)

        // Convert Float32 [-1, 1] to Int16 PCM
        const int16 = new Int16Array(resampled.length)
        for (let i = 0; i < resampled.length; i++) {
          const clamped = Math.max(-1, Math.min(1, resampled[i]))
          int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF
        }

        cleanup()
        resolve(int16.buffer)
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

/** Simple linear interpolation downsample */
function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer
  const ratio = fromRate / toRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const floor = Math.floor(srcIndex)
    const frac = srcIndex - floor
    const a = buffer[floor] ?? 0
    const b = buffer[Math.min(floor + 1, buffer.length - 1)] ?? 0
    result[i] = a + frac * (b - a)
  }
  return result
}

export function isRecordingActive(): boolean {
  return mediaRecorder !== null && mediaRecorder.state === 'recording'
}
