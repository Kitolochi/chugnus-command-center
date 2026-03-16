import { create } from 'zustand'

interface VoiceState {
  isRecording: boolean
  isTranscribing: boolean
  isSpeaking: boolean
  voiceEnabled: boolean
  autoTtsEnabled: boolean
  modelReady: boolean
  modelDownloading: boolean
  modelProgress: number
  lastTranscription: string
  inputDeviceId: string
  outputDeviceId: string

  setRecording: (v: boolean) => void
  setTranscribing: (v: boolean) => void
  setSpeaking: (v: boolean) => void
  toggleVoice: () => void
  toggleAutoTts: () => void
  setModelReady: (v: boolean) => void
  setModelDownloading: (v: boolean) => void
  setModelProgress: (v: number) => void
  setLastTranscription: (v: string) => void
  setInputDeviceId: (v: string) => void
  setOutputDeviceId: (v: string) => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isRecording: false,
  isTranscribing: false,
  isSpeaking: false,
  voiceEnabled: true,
  autoTtsEnabled: true,
  modelReady: false,
  modelDownloading: false,
  modelProgress: 0,
  lastTranscription: '',
  inputDeviceId: '',
  outputDeviceId: '',

  setRecording: (v) => set({ isRecording: v }),
  setTranscribing: (v) => set({ isTranscribing: v }),
  setSpeaking: (v) => set({ isSpeaking: v }),
  toggleVoice: () => set((s) => ({ voiceEnabled: !s.voiceEnabled })),
  toggleAutoTts: () => set((s) => ({ autoTtsEnabled: !s.autoTtsEnabled })),
  setModelReady: (v) => set({ modelReady: v }),
  setModelDownloading: (v) => set({ modelDownloading: v }),
  setModelProgress: (v) => set({ modelProgress: v }),
  setLastTranscription: (v) => set({ lastTranscription: v }),
  setInputDeviceId: (v) => set({ inputDeviceId: v }),
  setOutputDeviceId: (v) => set({ outputDeviceId: v }),
}))
