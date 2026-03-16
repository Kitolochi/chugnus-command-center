import { useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, Loader2, Download, SkipForward, Radio } from 'lucide-react'
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
    modelDownloading, modelProgress, lastTranscription,
    alwaysListening,
    setRecording, setTranscribing, setSpeaking, setModelReady, setModelDownloading, setModelProgress,
    setLastTranscription, toggleVoice, setInputDeviceId, setOutputDeviceId, toggleAlwaysListening,
  } = useVoiceStore()

  // --- Speech queue refs (mutation-only, no re-renders) ---
  const speechQueueRef = useRef<QueueItem[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())
  const currentItemRef = useRef<QueueItem | null>(null)
  const processingRef = useRef(false)
  const finishRef = useRef<() => Promise<void>>(async () => {})

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

  // --- Helper: start recording with max-duration callback ---
  const beginRecording = useCallback(async () => {
    const store = useVoiceStore.getState()
    if (!store.voiceEnabled || !store.modelReady) return false
    if (store.isRecording || store.isTranscribing) return false
    try {
      await startRecording(store.inputDeviceId || undefined, () => finishRef.current())
      useVoiceStore.getState().setRecording(true)
      return true
    } catch (err) {
      console.error('[voice] Failed to start recording:', err)
      return false
    }
  }, [])

  // --- Core pipeline: speak → delay → record → transcribe → respond → next ---
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

    // 3. Delay after speech so mic doesn't pick up TTS echo
    await new Promise(r => setTimeout(r, 800))

    // 4. Auto-start recording (if still enabled)
    const started = await beginRecording()
    if (!started) {
      currentItemRef.current = null
      processingRef.current = false
      processNext()
    }
  }, [setSpeaking, beginRecording])

  // --- Finish current recording: transcribe, respond, advance ---
  const finishRecordingAndRespond = useCallback(async () => {
    if (!useVoiceStore.getState().isRecording) return // guard against double-fire
    setRecording(false)
    setTranscribing(true)
    try {
      const audioBuffer = await stopRecording()
      const result = await window.electronAPI.voiceTranscribe(audioBuffer)
      setLastTranscription(result.text || '(no speech detected)')
      if (result.text && currentItemRef.current) {
        useCommandCenterStore.getState().respond(currentItemRef.current.processId, result.text)
      }
    } catch (err) {
      console.error('[voice] Transcription failed:', err)
      setLastTranscription('(transcription error)')
    } finally {
      setTranscribing(false)
      currentItemRef.current = null
      processingRef.current = false
      // Continue to next queue item if any
      if (speechQueueRef.current.length > 0) {
        setTimeout(() => processNext(), 500)
      } else if (useVoiceStore.getState().alwaysListening) {
        // Always-listening: restart recording after a brief pause
        setTimeout(() => beginRecording(), 300)
      }
    }
  }, [setRecording, setTranscribing, setLastTranscription, processNext, beginRecording])

  // Keep ref in sync so max-duration callback always calls latest version
  finishRef.current = finishRecordingAndRespond

  // --- Skip dialogue: cancel current speech, jump to recording ---
  const skipDialogue = useCallback(() => {
    cancelSpeech()
    setSpeaking(false)
  }, [setSpeaking])

  // --- Always-listening: auto-start recording when idle ---
  useEffect(() => {
    if (!alwaysListening || !voiceEnabled || !modelReady) return
    if (isRecording || isTranscribing || isSpeaking || modelDownloading) return
    if (processingRef.current) return

    // Small delay to avoid rapid re-triggers
    const timer = setTimeout(() => {
      beginRecording()
    }, 500)
    return () => clearTimeout(timer)
  }, [alwaysListening, voiceEnabled, modelReady, isRecording, isTranscribing, isSpeaking, modelDownloading, beginRecording])

  // Listen for hotkey from main process
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceHotkey(async () => {
      try {
        if (!voiceEnabled) return

        if (isSpeaking) {
          skipDialogue()
          return
        }

        if (isRecording) {
          await finishRecordingAndRespond()
          return
        }

        // Idle — manual start recording (outside of queue flow)
        if (!modelReady) {
          handleDownloadModel()
          return
        }
        await beginRecording()
      } catch (err) {
        console.error('[voice] Hotkey handler error:', err)
      }
    })
    return cleanup
  }, [voiceEnabled, isRecording, isSpeaking, modelReady, skipDialogue, finishRecordingAndRespond, beginRecording])

  // Listen for model download progress
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceModelProgress((pct) => {
      setModelProgress(pct)
    })
    return cleanup
  }, [])

  // --- Effect A: Detect new awaiting_input items → enqueue ---
  const queue = useCommandCenterStore(s => s.queue)
  const { autoTtsEnabled } = useVoiceStore()

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
    if (!lastTranscription || lastTranscription.startsWith('(')) return
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
    label = alwaysListening ? 'Listening...' : 'Recording...'
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

  // Show last transcription briefly
  const showTranscription = lastTranscription && !isRecording && !isSpeaking

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1.5">
      {/* Transcription feedback */}
      {showTranscription && (
        <div className="max-w-[280px] px-2.5 py-1.5 rounded-lg bg-surface-3 border border-white/10 text-[10px] text-white/60 leading-relaxed animate-fade-in">
          <span className="text-white/30 mr-1">You said:</span>
          {lastTranscription}
        </div>
      )}

      <div className="flex items-center gap-2">
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

        {/* Always-listening toggle */}
        {voiceEnabled && modelReady && (
          <button
            onClick={toggleAlwaysListening}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-full border transition-all text-[10px] font-medium ${
              alwaysListening
                ? 'border-accent-red/40 bg-accent-red/10 text-accent-red'
                : 'border-white/10 bg-surface-3 text-white/30 hover:text-white/50 hover:border-white/20'
            }`}
            title={alwaysListening ? 'Turn off always-listening' : 'Turn on always-listening (open mic)'}
          >
            <Radio size={12} />
            <span>{alwaysListening ? 'Live' : 'Open mic'}</span>
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
    </div>
  )
}
