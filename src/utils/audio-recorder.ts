const SAMPLE_RATE = 16000
const BUFFER_SIZE = 4096

let audioContext: AudioContext | null = null
let mediaStream: MediaStream | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let scriptNode: ScriptProcessorNode | null = null
let pcmChunks: Float32Array[] = []

export async function startRecording(): Promise<void> {
  pcmChunks = []

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })

  audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
  sourceNode = audioContext.createMediaStreamSource(mediaStream)
  scriptNode = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1)

  scriptNode.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0)
    pcmChunks.push(new Float32Array(data))
  }

  sourceNode.connect(scriptNode)
  scriptNode.connect(audioContext.destination)
}

export async function stopRecording(): Promise<ArrayBuffer> {
  // Disconnect nodes
  if (scriptNode) {
    scriptNode.disconnect()
    scriptNode = null
  }
  if (sourceNode) {
    sourceNode.disconnect()
    sourceNode = null
  }
  if (audioContext) {
    await audioContext.close()
    audioContext = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }

  // Merge chunks into a single Float32Array
  const totalLength = pcmChunks.reduce((sum, c) => sum + c.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0
  for (const chunk of pcmChunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  pcmChunks = []

  // Convert Float32 [-1, 1] to Int16 PCM
  const int16 = new Int16Array(merged.length)
  for (let i = 0; i < merged.length; i++) {
    const clamped = Math.max(-1, Math.min(1, merged[i]))
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF
  }

  return int16.buffer
}

export function isRecordingActive(): boolean {
  return mediaStream !== null
}
