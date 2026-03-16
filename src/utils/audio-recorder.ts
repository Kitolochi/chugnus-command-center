const TARGET_SAMPLE_RATE = 16000
const SILENCE_THRESHOLD = 0.015  // RMS below this = silence
const SILENCE_TIMEOUT_MS = 2000  // auto-stop after 2s of silence
const CHECK_INTERVAL_MS = 150    // how often to check for silence

let mediaStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let silenceTimer: ReturnType<typeof setInterval> | null = null
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let onSilenceCallback: (() => void) | null = null

/** Clean up all audio resources */
function cleanup(): void {
  if (silenceTimer) { clearInterval(silenceTimer); silenceTimer = null }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop() } catch {}
  }
  mediaRecorder = null
  if (audioContext && audioContext.state !== 'closed') {
    try { audioContext.close() } catch {}
  }
  audioContext = null
  analyser = null
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }
  audioChunks = []
  onSilenceCallback = null
}

export async function startRecording(deviceId?: string, onSilence?: () => void): Promise<void> {
  cleanup()
  audioChunks = []
  onSilenceCallback = onSilence || null

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  })

  // Set up MediaRecorder for capturing audio data
  mediaRecorder = new MediaRecorder(mediaStream)
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data)
  }
  mediaRecorder.start(250)

  // Set up AnalyserNode for silence detection (read-only, won't crash renderer)
  audioContext = new AudioContext()
  const source = audioContext.createMediaStreamSource(mediaStream)
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)

  // Monitor silence
  let silentSince: number | null = null
  const dataArray = new Float32Array(analyser.fftSize)

  silenceTimer = setInterval(() => {
    if (!analyser) return
    analyser.getFloatTimeDomainData(dataArray)

    // Calculate RMS
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i]
    }
    const rms = Math.sqrt(sum / dataArray.length)

    if (rms < SILENCE_THRESHOLD) {
      if (!silentSince) silentSince = Date.now()
      else if (Date.now() - silentSince >= SILENCE_TIMEOUT_MS) {
        // 2s of silence — fire callback
        if (onSilenceCallback) onSilenceCallback()
        silentSince = null
      }
    } else {
      silentSince = null
    }
  }, CHECK_INTERVAL_MS)
}

export async function stopRecording(): Promise<ArrayBuffer> {
  // Stop silence monitoring immediately
  if (silenceTimer) { clearInterval(silenceTimer); silenceTimer = null }
  onSilenceCallback = null

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

        // Decode audio blob to PCM using AudioContext
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
