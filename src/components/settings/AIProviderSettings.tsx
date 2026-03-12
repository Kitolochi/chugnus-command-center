import { useState, useEffect, useCallback } from 'react'
import { LLMSettings, LLMProvider } from '../../types'

const PROVIDER_INFO: Record<string, { label: string; color: string; helpUrl: string; helpText: string }> = {
  claude: { label: 'Claude', color: '#d97706', helpUrl: 'console.anthropic.com', helpText: 'Uses the Claude API key above' },
  gemini: { label: 'Gemini', color: '#4285f4', helpUrl: 'ai.google.dev', helpText: 'Free tier with generous limits' },
  groq: { label: 'Groq', color: '#f55036', helpUrl: 'console.groq.com', helpText: 'Free tier, very fast inference' },
  openrouter: { label: 'OpenRouter', color: '#8b5cf6', helpUrl: 'openrouter.ai', helpText: 'Access many models, some free' },
  chatgpt: { label: 'ChatGPT', color: '#10a37f', helpUrl: '', helpText: 'Uses ChatGPT Plus via local proxy' },
  claudeProxy: { label: 'Claude Pro', color: '#d97706', helpUrl: '', helpText: 'Uses Claude Pro via local proxy' },
}

const inputClass = "w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 focus:bg-surface-3 transition-all placeholder-muted/50"

export default function AIProviderSettings() {
  const [apiKey, setApiKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [keyVerifying, setKeyVerifying] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [llmSettings, setLlmSettings] = useState<LLMSettings | null>(null)
  const [llmKeyInput, setLlmKeyInput] = useState('')
  const [llmKeyVerifying, setLlmKeyVerifying] = useState(false)
  const [llmKeyError, setLlmKeyError] = useState<string | null>(null)
  const [llmKeySuccess, setLlmKeySuccess] = useState(false)
  const [providerModels, setProviderModels] = useState<Record<string, { primary: { id: string; name: string }[]; fast: { id: string; name: string }[] }>>({})

  const loadData = useCallback(async () => {
    const [key, llm, models] = await Promise.all([
      window.electronAPI.getClaudeApiKey(),
      window.electronAPI.getLLMSettings(),
      window.electronAPI.getProviderModels(),
    ])
    setApiKey(key)
    setLlmSettings(llm)
    setProviderModels(models)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return
    setKeyVerifying(true)
    setKeyError(null)
    const result = await window.electronAPI.verifyClaudeKey(keyInput.trim())
    if (result.valid) {
      await window.electronAPI.saveClaudeApiKey(keyInput.trim())
      setApiKey(keyInput.trim())
      setKeyError(null)
    } else {
      setKeyError(result.error || 'Invalid key')
    }
    setKeyVerifying(false)
  }

  const handleRemoveKey = () => {
    setApiKey('')
    window.electronAPI.saveClaudeApiKey('')
    setKeyInput('')
  }

  const isProviderReady = (provider: string): boolean => {
    if (provider === 'chatgpt' || provider === 'claudeProxy') return true
    if (provider === 'claude') return !!apiKey
    if (!llmSettings) return false
    if (provider === 'gemini') return !!llmSettings.geminiApiKey
    if (provider === 'groq') return !!llmSettings.groqApiKey
    if (provider === 'openrouter') return !!llmSettings.openrouterApiKey
    return false
  }

  if (!llmSettings) return null

  const activeProvider = llmSettings.provider || 'claude'
  const activeInfo = PROVIDER_INFO[activeProvider]

  return (
    <div className="mb-6">
      <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">AI Provider</label>

      <div className="rounded-xl border border-white/[0.08] bg-surface-1/80 overflow-hidden">
        {/* Active provider banner */}
        <div className="px-4 py-3 border-b border-white/[0.06]" style={{ borderLeftWidth: 3, borderLeftColor: activeInfo.color }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/90">Using {activeInfo.label}</span>
              {isProviderReady(activeProvider) ? (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium">Active</span>
              ) : (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">No key</span>
              )}
            </div>
            <span className="text-[9px] text-muted">{activeInfo.helpText}</span>
          </div>
        </div>

        {/* Provider tabs */}
        <div className="flex border-b border-white/[0.06]">
          {(['claude', 'gemini', 'groq', 'openrouter', 'chatgpt', 'claudeProxy'] as LLMProvider[]).map(p => {
            const info = PROVIDER_INFO[p]
            const isActive = llmSettings.provider === p
            const hasKey = isProviderReady(p)
            return (
              <button
                key={p}
                onClick={async () => {
                  const updates: any = { provider: p }
                  const models = providerModels[p]
                  if (models) {
                    updates.primaryModel = models.primary[0]?.id
                    updates.fastModel = models.fast[0]?.id
                  }
                  const updated = await window.electronAPI.saveLLMSettings(updates)
                  setLlmSettings(updated)
                  setLlmKeyInput('')
                  setLlmKeyError(null)
                  setLlmKeySuccess(false)
                }}
                className={`flex-1 relative py-2.5 text-[11px] font-medium transition-all ${
                  isActive
                    ? 'text-white bg-surface-2/80'
                    : 'text-muted hover:text-white/70 hover:bg-surface-2/40'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {hasKey && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  )}
                  {info.label}
                </div>
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ backgroundColor: info.color }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Provider config area */}
        <div className="p-4 space-y-3">
          {/* API Key section */}
          {(activeProvider === 'chatgpt' || activeProvider === 'claudeProxy') ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-2/60">
              <svg className="w-3.5 h-3.5 text-accent-emerald shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[11px] text-white/60 flex-1">
                {activeProvider === 'chatgpt' ? 'Uses ChatGPT Plus subscription via local proxy (port 8741)' : 'Uses Claude Pro subscription via local proxy (port 8741)'}
              </span>
            </div>
          ) : activeProvider === 'claude' ? (
            <div>
              {apiKey ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-2/60">
                  <svg className="w-3.5 h-3.5 text-accent-emerald shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[11px] text-white/60 flex-1">Claude API key configured</span>
                  <button onClick={handleRemoveKey} className="text-[10px] text-muted hover:text-accent-red transition-colors">Remove</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    placeholder="sk-ant-..."
                    className={inputClass}
                  />
                  {keyError && <p className="text-[10px] text-accent-red">{keyError}</p>}
                  <button onClick={handleSaveKey} disabled={!keyInput.trim() || keyVerifying} className="w-full py-2 bg-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-30 rounded-lg text-xs text-accent-blue font-medium transition-all">
                    {keyVerifying ? 'Verifying...' : 'Verify & Save Key'}
                  </button>
                  <p className="text-[10px] text-muted/50">Get a key at console.anthropic.com</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              {(() => {
                const keyField = activeProvider === 'gemini' ? 'geminiApiKey' as const : activeProvider === 'groq' ? 'groqApiKey' as const : 'openrouterApiKey' as const
                const currentKey = llmSettings[keyField]

                if (currentKey) {
                  return (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-2/60">
                      <svg className="w-3.5 h-3.5 text-accent-emerald shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[11px] text-white/60 flex-1">{activeInfo.label} key configured</span>
                      <button
                        onClick={async () => {
                          const updated = await window.electronAPI.saveLLMSettings({ [keyField]: '' })
                          setLlmSettings(updated)
                          setLlmKeyInput('')
                        }}
                        className="text-[10px] text-muted hover:text-accent-red transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  )
                }

                return (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={llmKeyInput}
                      onChange={e => setLlmKeyInput(e.target.value)}
                      placeholder={`${activeInfo.label} API key...`}
                      className={inputClass}
                    />
                    {llmKeyError && <p className="text-[10px] text-accent-red">{llmKeyError}</p>}
                    {llmKeySuccess && <p className="text-[10px] text-accent-emerald">Key verified and saved!</p>}
                    <button
                      onClick={async () => {
                        if (!llmKeyInput.trim()) return
                        setLlmKeyVerifying(true)
                        setLlmKeyError(null)
                        setLlmKeySuccess(false)
                        const result = await window.electronAPI.verifyLLMKey(llmSettings.provider, llmKeyInput.trim())
                        if (result.valid) {
                          const updated = await window.electronAPI.saveLLMSettings({ [keyField]: llmKeyInput.trim() })
                          setLlmSettings(updated)
                          setLlmKeySuccess(true)
                          setLlmKeyInput('')
                          setTimeout(() => setLlmKeySuccess(false), 3000)
                        } else {
                          setLlmKeyError(result.error || 'Invalid key')
                        }
                        setLlmKeyVerifying(false)
                      }}
                      disabled={!llmKeyInput.trim() || llmKeyVerifying}
                      className="w-full py-2 bg-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-30 rounded-lg text-xs text-accent-blue font-medium transition-all"
                    >
                      {llmKeyVerifying ? 'Verifying...' : 'Verify & Save Key'}
                    </button>
                    <p className="text-[10px] text-muted/50">Get a free key at {activeInfo.helpUrl}</p>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Model selectors */}
          {providerModels[activeProvider] && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-muted/60 mb-1 font-medium">Primary Model</label>
                <select
                  value={llmSettings.primaryModel}
                  onChange={async e => {
                    const updated = await window.electronAPI.saveLLMSettings({ primaryModel: e.target.value })
                    setLlmSettings(updated)
                  }}
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[10px] text-white/90 focus:outline-none focus:border-accent-blue/40 [&>option]:bg-surface-2 [&>option]:text-white/80"
                >
                  {providerModels[activeProvider].primary.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <p className="text-[8px] text-muted/40 mt-0.5">Research, planning, action plans</p>
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-muted/60 mb-1 font-medium">Fast Model</label>
                <select
                  value={llmSettings.fastModel}
                  onChange={async e => {
                    const updated = await window.electronAPI.saveLLMSettings({ fastModel: e.target.value })
                    setLlmSettings(updated)
                  }}
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[10px] text-white/90 focus:outline-none focus:border-accent-blue/40 [&>option]:bg-surface-2 [&>option]:text-white/80"
                >
                  {providerModels[activeProvider].fast.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <p className="text-[8px] text-muted/40 mt-0.5">Summaries, memory, tweets</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
