const TARGET_SAMPLE_RATE = 16000

let audioContext: AudioContext | null = null
let mediaStream: MediaStream | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let workletNode: AudioWorkletNode | null = null
let pcmChunks: Float32Array[] = []
let workletReady = false

const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (ch && ch.length > 0) {
      this.port.postMessage(new Float32Array(ch))
    }
    return true
  }
}
registerProcessor('pcm-processor', PCMProcessor)
`

/** Clean up all audio resources */
async function cleanup(): Promise<void> {
  if (workletNode) {
    try { workletNode.disconnect() } catch {}
    workletNode = null
  }
  if (sourceNode) {
    try { sourceNode.disconnect() } catch {}
    sourceNode = null
  }
  if (audioContext && audioContext.state !== 'closed') {
    try { await audioContext.close() } catch {}
  }
  audioContext = null
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }
}

export async function startRecording(deviceId?: string): Promise<void> {
  // Always clean up previous recording first
  await cleanup()
  pcmChunks = []

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  })

  // Use browser's default sample rate (usually 48000) — we'll downsample on stop
  audioContext = new AudioContext()

  // Register AudioWorklet processor (once per context)
  if (!workletReady) {
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    await audioContext.audioWorklet.addModule(url)
    URL.revokeObjectURL(url)
    workletReady = true
  }

  sourceNode = audioContext.createMediaStreamSource(mediaStream)
  workletNode = new AudioWorkletNode(audioContext, 'pcm-processor')

  workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
    pcmChunks.push(e.data)
  }

  sourceNode.connect(workletNode)
  // Connect to destination to keep the audio graph alive
  workletNode.connect(audioContext.destination)
}

export async function stopRecording(): Promise<ArrayBuffer> {
  const nativeSampleRate = audioContext?.sampleRate ?? 48000

  await cleanup()
  // workletReady must be reset since the context was closed
  workletReady = false

  // Merge chunks into a single Float32Array
  const totalLength = pcmChunks.reduce((sum, c) => sum + c.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0
  for (const chunk of pcmChunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  pcmChunks = []

  // Downsample from native rate to 16kHz for Whisper
  const resampled = downsample(merged, nativeSampleRate, TARGET_SAMPLE_RATE)

  // Convert Float32 [-1, 1] to Int16 PCM
  const int16 = new Int16Array(resampled.length)
  for (let i = 0; i < resampled.length; i++) {
    const clamped = Math.max(-1, Math.min(1, resampled[i]))
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF
  }

  return int16.buffer
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
  return mediaStream !== null
}
