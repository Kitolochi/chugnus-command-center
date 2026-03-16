const TARGET_SAMPLE_RATE = 16000
const SILENCE_THRESHOLD = 0.01  // RMS below this = silence
const SILENCE_CHUNKS = 8        // 8 × 250ms = 2s of silence to auto-stop
const CHUNK_INTERVAL_MS = 250

let mediaStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let onSilenceCallback: (() => void) | null = null
let silentChunkCount = 0
let hasSpeechStarted = false

/** Clean up all audio resources */
function cleanup(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop() } catch {}
  }
  mediaRecorder = null
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }
  audioChunks = []
  onSilenceCallback = null
  silentChunkCount = 0
  hasSpeechStarted = false
}

/** Check if an audio chunk contains silence by decoding and checking RMS */
async function isChunkSilent(chunk: Blob): Promise<boolean> {
  try {
    const arrayBuffer = await chunk.arrayBuffer()
    if (arrayBuffer.byteLength < 100) return true
    const ctx = new AudioContext()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    await ctx.close()
    const samples = audioBuffer.getChannelData(0)
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i]
    }
    const rms = Math.sqrt(sum / samples.length)
    return rms < SILENCE_THRESHOLD
  } catch {
    return false // decode error = assume not silent
  }
}

export async function startRecording(deviceId?: string, onSilence?: () => void): Promise<void> {
  cleanup()
  audioChunks = []
  onSilenceCallback = onSilence || null
  silentChunkCount = 0
  hasSpeechStarted = false

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  })

  mediaRecorder = new MediaRecorder(mediaStream)
  mediaRecorder.ondataavailable = async (e) => {
    if (e.data.size > 0) {
      audioChunks.push(e.data)

      // Check silence on each chunk (offline decode, no live AudioContext)
      if (onSilenceCallback) {
        const silent = await isChunkSilent(e.data)
        if (silent) {
          // Only start counting silence after speech has been detected
          if (hasSpeechStarted) {
            silentChunkCount++
            if (silentChunkCount >= SILENCE_CHUNKS) {
              onSilenceCallback()
            }
          }
        } else {
          hasSpeechStarted = true
          silentChunkCount = 0
        }
      }
    }
  }
  mediaRecorder.start(CHUNK_INTERVAL_MS)
}

export async function stopRecording(): Promise<ArrayBuffer> {
  onSilenceCallback = null // prevent double-fire from silence detection

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
