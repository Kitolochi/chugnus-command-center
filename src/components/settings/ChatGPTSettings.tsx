import { useState, useEffect } from 'react'

interface ChatGPTProfile {
  sub: string
  name: string
  email: string
}

export default function ChatGPTSettings() {
  const [status, setStatus] = useState<'loading' | 'disconnected' | 'connected' | 'signing-in' | 'error'>('loading')
  const [profile, setProfile] = useState<ChatGPTProfile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    try {
      const result = await window.electronAPI.chatgptOAuthStatus()
      if (result.connected && result.profile) {
        setProfile(result.profile)
        setStatus('connected')
      } else {
        setStatus('disconnected')
      }
    } catch {
      setStatus('disconnected')
    }
  }

  async function handleSignIn() {
    setStatus('signing-in')
    setError('')
    try {
      const result = await window.electronAPI.chatgptOAuthStart()
      if (result.connected) {
        setProfile(result.profile)
        setStatus('connected')
      }
    } catch (err: any) {
      setError(err.message || 'Sign-in failed')
      setStatus('error')
    }
  }

  async function handleDisconnect() {
    try {
      await window.electronAPI.chatgptOAuthDisconnect()
      setProfile(null)
      setStatus('disconnected')
    } catch (err: any) {
      setError(err.message || 'Disconnect failed')
    }
  }

  return (
    <div className="mb-6 animate-stagger-in" style={{ animationDelay: '60ms' }}>
      <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">
        ChatGPT Account
      </label>
      <div className="glass-card rounded-xl p-3 hover-lift">
        {status === 'loading' && (
          <p className="text-[11px] text-white/40">Loading...</p>
        )}

        {status === 'disconnected' && (
          <div>
            <p className="text-[11px] text-white/50 mb-3">
              Sign in with your ChatGPT account to link your OpenAI identity.
            </p>
            <button
              onClick={handleSignIn}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ backgroundColor: '#10a37f' }}
            >
              Sign in with ChatGPT
            </button>
          </div>
        )}

        {status === 'signing-in' && (
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <span className="text-[11px] text-white/50">Waiting for sign-in...</span>
          </div>
        )}

        {status === 'connected' && profile && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f' }}>
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <span className="text-[11px] text-white/80 font-medium">{profile.name}</span>
                {profile.email && (
                  <span className="text-[10px] text-white/40 ml-1.5">{profile.email}</span>
                )}
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-[10px] text-white/30 hover:text-red-400 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p className="text-[11px] text-red-400 mb-2">{error}</p>
            <button
              onClick={handleSignIn}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ backgroundColor: '#10a37f' }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
