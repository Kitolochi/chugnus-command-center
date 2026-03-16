import { useEffect } from 'react'
import { Mic, MicOff, Volume2, Loader2, Download } from 'lucide-react'
import { useVoiceStore } from '../../store/voiceStore'
import { startRecording, stopRecording } from '../../utils/audio-recorder'
import { cancelSpeech } from '../../utils/tts'

export default function VoiceIndicator() {
  const {
    isRecording, isTranscribing, isSpeaking, voiceEnabled, modelReady,
    modelDownloading, modelProgress,
    setRecording, setTranscribing, setSpeaking, setModelReady, setModelDownloading, setModelProgress,
    setLastTranscription, toggleVoice,
  } = useVoiceStore()

  // Check model status on mount
  useEffect(() => {
    window.electronAPI.voiceModelStatus().then((status) => {
      setModelReady(status.ready || status.downloaded)
    })
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
          await startRecording()
          setRecording(true)
        } catch (err) {
          console.error('[voice] Failed to start recording:', err)
        }
      }
    })
    return cleanup
  }, [voiceEnabled, isRecording, isSpeaking, modelReady])

  // Listen for model download progress
  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceModelProgress((pct) => {
      setModelProgress(pct)
    })
    return cleanup
  }, [])

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
