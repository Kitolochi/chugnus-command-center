import { useEffect, useRef } from 'react'
import { Mic, MicOff, Volume2, Loader2, Download } from 'lucide-react'
import { useVoiceStore } from '../../store/voiceStore'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { startRecording, stopRecording } from '../../utils/audio-recorder'
import { cancelSpeech, speakText } from '../../utils/tts'

export default function VoiceIndicator() {
  const {
    isRecording, isTranscribing, isSpeaking, voiceEnabled, modelReady,
    modelDownloading, modelProgress, inputDeviceId,
    setRecording, setTranscribing, setSpeaking, setModelReady, setModelDownloading, setModelProgress,
    setLastTranscription, toggleVoice, setInputDeviceId, setOutputDeviceId,
  } = useVoiceStore()

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

  // Listen for hotkey from main process
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceHotkey(async () => {
      if (!voiceEnabled) return

      if (isSpeaking) {
        cancelSpeech()
        setSpeaking(false)
        return
      }

      if (isRecording) {
        // Stop recording and transcribe
        setRecording(false)
        setTranscribing(true)
        try {
          const pcmBuffer = await stopRecording()
          const result = await window.electronAPI.voiceTranscribe(pcmBuffer)
          if (result.text) {
            setLastTranscription(result.text)
          }
        } catch (err) {
          console.error('[voice] Transcription failed:', err)
        } finally {
          setTranscribing(false)
        }
      } else {
        // Start recording
        if (!modelReady) {
          // Trigger model download
          handleDownloadModel()
          return
        }
        try {
          await startRecording(inputDeviceId || undefined)
          setRecording(true)
        } catch (err) {
          console.error('[voice] Failed to start recording:', err)
        }
      }
    })
    return cleanup
  }, [voiceEnabled, isRecording, isSpeaking, modelReady, inputDeviceId])

  // Listen for model download progress
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceModelProgress((pct) => {
      setModelProgress(pct)
    })
    return cleanup
  }, [])

  // --- Voice Queue Loop: Effect A — Auto-speak on new awaiting_input ---
  const queue = useCommandCenterStore(s => s.queue)
  const { autoTtsEnabled, lastTranscription } = useVoiceStore()
  const spokenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!voiceEnabled || !autoTtsEnabled) return

    // Clean stale processIds from the spoken set
    const currentIds = new Set(queue.map(i => i.processId))
    for (const id of spokenRef.current) {
      if (!currentIds.has(id)) spokenRef.current.delete(id)
    }

    // Find new awaiting_input items not yet spoken
    const newAwaiting = queue.find(
      i => i.status === 'awaiting_input' && i.resultText && !spokenRef.current.has(i.processId)
    )
    if (!newAwaiting) return

    spokenRef.current.add(newAwaiting.processId)

    ;(async () => {
      let summary: string
      try {
        summary = await window.electronAPI.ccSummarizeForVoice(newAwaiting.resultText!)
      } catch {
        summary = newAwaiting.resultText!.slice(0, 200)
      }

      cancelSpeech()
      setSpeaking(true)
      speakText(
        summary,
        () => {
          setSpeaking(false)
          // 500ms delay before auto-starting recording to avoid mic picking up TTS
          setTimeout(async () => {
            if (!useVoiceStore.getState().voiceEnabled) return
            if (!useVoiceStore.getState().modelReady) return
            try {
              await startRecording(useVoiceStore.getState().inputDeviceId || undefined)
              useVoiceStore.getState().setRecording(true)
            } catch (err) {
              console.error('[voice-queue] Failed to auto-start recording:', err)
            }
          }, 500)
        },
        () => setSpeaking(false),
      )
    })()
  }, [queue, voiceEnabled, autoTtsEnabled])

  // --- Voice Queue Loop: Effect B — Auto-respond with transcription ---
  useEffect(() => {
    if (!lastTranscription) return
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

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
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
      </button>
    </div>
  )
}
