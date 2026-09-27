import { useState } from 'react'
import { Brain } from 'lucide-react'
import type { CodexSession } from '../../types/codex'

export default function CodexMemory({ session }: { session: CodexSession }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const extract = async () => {
    if (!session.threadId) return
    setBusy(true); setMessage('')
    try {
      const memories = await window.electronAPI.codexExtractMemories(session.threadId)
      setMessage(memories.length ? `Saved ${memories.length} memories to the Memories tab.` : 'No new memories to save.')
    } catch (error) { setMessage(String(error)) }
    finally { setBusy(false) }
  }
  return <div className="text-[10px] text-white/40 space-y-1">
    <div className="flex gap-3 items-center flex-wrap">
      <span title={session.memoryTitles?.join('\n')}>{session.memoryTitles?.length || 0} saved memories used this turn</span>
      <button onClick={extract} disabled={busy || session.status === 'working' || !session.threadId} className="flex gap-1 items-center text-accent-amber disabled:opacity-30"><Brain size={12} /> {busy ? 'Extracting…' : 'Extract memories'}</button>
    </div>
    {(message || session.memoryError) && <p role="status">{message || session.memoryError}</p>}
  </div>
}
