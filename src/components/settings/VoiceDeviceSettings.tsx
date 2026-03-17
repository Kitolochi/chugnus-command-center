import { useState, useEffect, useCallback } from 'react'
import { VoiceDeviceSettings as VoiceDeviceSettingsType } from '../../types'
import { useVoiceStore } from '../../store/voiceStore'

const selectClass = "w-full bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[10px] text-white/90 focus:outline-none focus:border-accent-blue/40 [&>option]:bg-surface-2 [&>option]:text-white/80"

interface DeviceInfo {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

export default function VoiceDeviceSettings() {
  const [settings, setSettings] = useState<VoiceDeviceSettingsType>({ inputDeviceId: '', outputDeviceId: '', ttsRate: 1.5 })
  const [inputs, setInputs] = useState<DeviceInfo[]>([])
  const [outputs, setOutputs] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const { setInputDeviceId, setOutputDeviceId, ttsRate, setTtsRate } = useVoiceStore()

  const enumerateDevices = useCallback(async () => {
    try {
      // Request mic permission first — needed for device labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      setInputs(devices.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone (${d.deviceId.slice(0, 8)})`, kind: d.kind })))
      setOutputs(devices.filter(d => d.kind === 'audiooutput').map(d => ({ deviceId: d.deviceId, label: d.label || `Speaker (${d.deviceId.slice(0, 8)})`, kind: d.kind })))
    } catch {
      setInputs([])
      setOutputs([])
    }
  }, [])

  useEffect(() => {
    Promise.all([
      window.electronAPI.getVoiceDeviceSettings(),
      enumerateDevices(),
    ]).then(([saved]) => {
      setSettings(saved)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [enumerateDevices])

  const handleInputChange = async (deviceId: string) => {
    const updated = await window.electronAPI.saveVoiceDeviceSettings({ inputDeviceId: deviceId })
    setSettings(updated)
    setInputDeviceId(deviceId)
  }

  const handleOutputChange = async (deviceId: string) => {
    const updated = await window.electronAPI.saveVoiceDeviceSettings({ outputDeviceId: deviceId })
    setSettings(updated)
    setOutputDeviceId(deviceId)
  }

  if (loading) return null

  return (
    <div className="mb-6 animate-stagger-in" style={{ animationDelay: '90ms' }}>
      <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">Voice Devices</label>
      <div className="glass-card rounded-xl p-3 hover-lift space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[9px] uppercase tracking-wider text-muted/60 font-medium">Input (Microphone)</label>
            <button
              onClick={enumerateDevices}
              className="text-[9px] text-accent-blue/70 hover:text-accent-blue transition-colors"
              title="Refresh device list"
            >
              Refresh
            </button>
          </div>
          <select
            value={settings.inputDeviceId}
            onChange={e => handleInputChange(e.target.value)}
            className={selectClass}
          >
            <option value="">System Default</option>
            {inputs.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-wider text-muted/60 mb-1 font-medium">Output (Speaker)</label>
          <select
            value={settings.outputDeviceId}
            onChange={e => handleOutputChange(e.target.value)}
            className={selectClass}
          >
            <option value="">System Default</option>
            {outputs.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
          <p className="text-[8px] text-muted/40 mt-1">TTS output always uses system default — Web Speech API limitation</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[9px] uppercase tracking-wider text-muted/60 font-medium">Speech Speed</label>
            <span className="text-[9px] text-white/50 font-mono">{ttsRate.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={ttsRate}
            onChange={async (e) => {
              const rate = parseFloat(e.target.value)
              setTtsRate(rate)
              const updated = await window.electronAPI.saveVoiceDeviceSettings({ ttsRate: rate })
              setSettings(updated)
            }}
            className="w-full h-1 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent-blue"
          />
          <div className="flex justify-between text-[7px] text-muted/30 mt-0.5">
            <span>0.5x</span>
            <span>1.5x</span>
            <span>3.0x</span>
          </div>
        </div>
      </div>
    </div>
  )
}
