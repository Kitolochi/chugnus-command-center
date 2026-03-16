import { useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, Loader2, Download, SkipForward } from 'lucide-react'
import { useVoiceStore } from '../../store/voiceStore'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { startRecording, stopRecording } from '../../utils/audio-recorder'
import { cancelSpeech, speakText } from '../../utils/tts'

interface QueueItem {
  processId: string
  resultText: string
}

export default function VoiceIndicator() {
  const {
    isRecording, isTranscribing, isSpeaking, voiceEnabled, modelReady,
    modelDownloading, modelProgress, inputDeviceId,
    setRecording, setTranscribing, setSpeaking, setModelReady, setModelDownloading, setModelProgress,
    setLastTranscription, toggleVoice, setInputDeviceId, setOutputDeviceId,
  } = useVoiceStore()

  // --- Speech queue refs (mutation-only, no re-renders) ---
  const speechQueueRef = useRef<QueueItem[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())
  const currentItemRef = useRef<QueueItem | null>(null)
  const processingRef = useRef(false)

  // Check model status + hydrate device settings on mount
  useEffect(() => {
    window.electronAPI.voiceModelStatus().then((status) => {
      setModelReady(status.ready || status.downloaded)
    })
    window.electronAPI.getVoiceDeviceSettings().then((settings) => {
      setInputDeviceId(settings.inputDeviceId)
      setOutputDeviceId(settings.outputDeviceId)
    }).catch(() => {})
  }, [])

  // --- Core pipeline: speak → record → transcribe → respond → next ---
  const processNext = useCallback(async () => {
    if (processingRef.current) return
    if (speechQueueRef.current.length === 0) return

    const store = useVoiceStore.getState()
    if (!store.voiceEnabled || !store.autoTtsEnabled) return

    processingRef.current = true
    const item = speechQueueRef.current.shift()!
    currentItemRef.current = item

    // 1. Summarize for speech
    let summary: string
    try {
      summary = await window.electronAPI.ccSummarizeForVoice(item.resultText)
    } catch {
      summary = item.resultText.slice(0, 200)
    }

    // 2. Speak — wait for completion or skip
    setSpeaking(true)
    await new Promise<void>((resolve) => {
      speakText(
        summary,
        () => { setSpeaking(false); resolve() },
        () => { setSpeaking(false); resolve() },
      )
    })

    // 3. After speech ends, auto-start recording (if still enabled and not skipped)
    const storeNow = useVoiceStore.getState()
    if (!storeNow.voiceEnabled || !storeNow.modelReady) {
      currentItemRef.current = null
      processingRef.current = false
      processNext()
      return
    }

    try {
      await startRecording(storeNow.inputDeviceId || undefined)
      setRecording(true)
    } catch (err) {
      console.error('[voice-queue] Failed to start recording:', err)
      currentItemRef.current = null
      processingRef.current = false
      processNext()
    }
    // Recording started — pipeline continues in hotkey handler (stop recording → transcribe → respond)
    // processNext will be called again after the response is sent
  }, [setSpeaking, setRecording])

  // --- Finish current pipeline step: transcribe, respond, advance ---
  const finishRecordingAndRespond = useCallback(async () => {
    setRecording(false)
    setTranscribing(true)
    try {
      const pcmBuffer = await stopRecording()
      const result = await window.electronAPI.voiceTranscribe(pcmBuffer)
      if (result.text && currentItemRef.current) {
        setLastTranscription(result.text)
        // Respond to the current awaiting item
        useCommandCenterStore.getState().respond(currentItemRef.current.processId, result.text)
      }
    } catch (err) {
      console.error('[voice] Transcription failed:', err)
    } finally {
      setTranscribing(false)
      currentItemRef.current = null
      processingRef.current = false
      // Small delay then process next item
      setTimeout(() => processNext(), 300)
    }
  }, [setRecording, setTranscribing, setLastTranscription, processNext])

  // --- Skip dialogue: cancel current speech, jump to recording ---
  const skipDialogue = useCallback(() => {
    cancelSpeech()
    setSpeaking(false)
    // The promise in processNext resolves via onend/onerror, advancing to recording
  }, [setSpeaking])

  // Listen for hotkey from main process
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceHotkey(async () => {
      if (!voiceEnabled) return

      if (isSpeaking) {
        // Skip dialogue — cancel speech and let pipeline continue to recording
        skipDialogue()
        return
      }

      if (isRecording) {
        // Stop recording and transcribe → respond → next
        await finishRecordingAndRespond()
        return
      }

      // Idle — manual start recording (outside of queue flow)
      if (!modelReady) {
        handleDownloadModel()
        return
      }
      try {
        await startRecording(inputDeviceId || undefined)
        setRecording(true)
      } catch (err) {
        console.error('[voice] Failed to start recording:', err)
      }
    })
    return cleanup
  }, [voiceEnabled, isRecording, isSpeaking, modelReady, inputDeviceId, skipDialogue, finishRecordingAndRespond])

  // Listen for model download progress
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceModelProgress((pct) => {
      setModelProgress(pct)
    })
    return cleanup
  }, [])

  // --- Effect A: Detect new awaiting_input items → enqueue ---
  const queue = useCommandCenterStore(s => s.queue)
  const { autoTtsEnabled, lastTranscription } = useVoiceStore()

  useEffect(() => {
    if (!voiceEnabled || !autoTtsEnabled) return

    // Clean stale IDs
    const currentIds = new Set(queue.map(i => i.processId))
    for (const id of seenIdsRef.current) {
      if (!currentIds.has(id)) seenIdsRef.current.delete(id)
    }

    // Find new awaiting_input items not yet seen
    const newItems = queue.filter(
      i => i.status === 'awaiting_input' && i.resultText && !seenIdsRef.current.has(i.processId)
    )

    for (const item of newItems) {
      seenIdsRef.current.add(item.processId)
      speechQueueRef.current.push({ processId: item.processId, resultText: item.resultText! })
    }

    // Kick off pipeline if idle
    if (newItems.length > 0 && !processingRef.current) {
      processNext()
    }
  }, [queue, voiceEnabled, autoTtsEnabled, processNext])

  // --- Effect B: Manual transcription response (outside queue flow) ---
  useEffect(() => {
    if (!lastTranscription) return
    // Only auto-respond if we're NOT in the queue pipeline (currentItemRef handles that)
    if (currentItemRef.current) return
    const awaitingItem = queue.find(i => i.status === 'awaiting_input')
    if (!awaitingItem) return
    const text = lastTranscription
    setLastTranscription('')
    useCommandCenterStore.getState().respond(awaitingItem.processId, text)
  }, [lastTranscription, queue])

  const handleDownloadModel = async () => {
    setModelDownloading(true)
    setModelProgress(0)
    const result = await window.electronAPI.voiceDownloadModel()
    setModelDownloading(false)
    if (result.success) {
      setModelReady(true)
    }
  }

  const handleStopSpeaking = () => {
    cancelSpeech()
    setSpeaking(false)
  }

  // Determine state for display
  let icon = <Mic size={14} />
  let label = 'Voice'
  let color = 'text-white/40'
  let bgColor = 'bg-surface-3'
  let pulse = false

  if (!voiceEnabled) {
    icon = <MicOff size={14} />
    label = 'Voice off'
    color = 'text-white/20'
  } else if (modelDownloading) {
    icon = <Download size={14} />
    label = `Model ${modelProgress}%`
    color = 'text-accent-blue'
    bgColor = 'bg-accent-blue/10'
  } else if (isRecording) {
    icon = <Mic size={14} />
    label = 'Recording...'
    color = 'text-accent-red'
    bgColor = 'bg-accent-red/10'
    pulse = true
  } else if (isTranscribing) {
    icon = <Loader2 size={14} className="animate-spin" />
    label = 'Transcribing...'
    color = 'text-accent-amber'
    bgColor = 'bg-accent-amber/10'
  } else if (isSpeaking) {
    icon = <Volume2 size={14} />
    label = 'Speaking...'
    color = 'text-accent-emerald'
    bgColor = 'bg-accent-emerald/10'
  } else if (!modelReady) {
    icon = <Download size={14} />
    label = 'Setup voice'
    color = 'text-white/30'
  }

  const queueCount = speechQueueRef.current.length + (currentItemRef.current ? 1 : 0)

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      {/* Skip button — visible while speaking */}
      {isSpeaking && (
        <button
          onClick={skipDialogue}
          className="flex items-center gap-1 px-2 py-1.5 rounded-full border border-white/10 bg-surface-3 text-white/40 hover:text-white/70 hover:border-white/20 transition-all text-[10px] font-medium"
          title="Skip dialogue (or press voice hotkey)"
        >
          <SkipForward size={12} />
          <span>Skip</span>
        </button>
      )}

      <button
        onClick={() => {
          if (isSpeaking) {
            handleStopSpeaking()
          } else if (!modelReady && !modelDownloading) {
            handleDownloadModel()
          } else {
            toggleVoice()
          }
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-white/10 ${bgColor} ${color} hover:border-white/20 transition-all text-[10px] font-medium`}
        title={isSpeaking ? 'Stop speaking' : !modelReady ? 'Download voice model' : 'Toggle voice (Ctrl+Shift+Space)'}
      >
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />}
        {icon}
        <span>{label}</span>
        {queueCount > 1 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-white/10 text-[8px]">{queueCount}</span>
        )}
      </button>
    </div>
  )
}
