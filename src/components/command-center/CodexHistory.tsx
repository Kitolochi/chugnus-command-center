import { useEffect, useState } from 'react'
import { useCodexStore } from '../../store/codexStore'
import type { CodexHistoryEntry } from '../../types/codex'

export default function CodexHistory() {
  const { sessions, update, select } = useCodexStore()
  const [entries, setEntries] = useState<CodexHistoryEntry[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState<string | null>(null)
  const [indexing, setIndexing] = useState(false)
  const [indexMessage, setIndexMessage] = useState('')
  useEffect(() => {
    let disposed = false
    window.electronAPI.codexHistory().then(result => { if (!disposed) setEntries(result) }).catch(err => { if (!disposed) setError(String(err)) }).finally(() => { if (!disposed) setLoading(false) })
    return () => { disposed = true }
  }, [])
  const open = async (entry: CodexHistoryEntry) => {
    setOpening(entry.threadId); setError('')
    try {
      const session = await window.electronAPI.codexImport(entry.threadId)
      update(session); select(session.id)
    } catch (err) { setError(String(err)) }
    finally { setOpening(null) }
  }
  const visible = entries.filter(entry => `${entry.title} ${entry.projectPath}`.toLowerCase().includes(search.toLowerCase()))
  const index = async () => {
    setIndexing(true); setError(''); setIndexMessage('')
    try { const result = await window.electronAPI.rebuildVectorIndex(); setIndexMessage(`Knowledge search updated: ${result.total.toLocaleString()} chunks indexed.`) }
    catch (err) { setError(String(err)) }
    finally { setIndexing(false) }
  }
  return <div className="bg-surface-1 border border-white/10 rounded-lg p-3 space-y-2">
    <div className="flex justify-between gap-2 items-center">
      <span className="text-xs text-white/70">All Codex sessions · {entries.length}</span>
      <input aria-label="Search Codex history" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search task or project…" className="bg-surface-2 border border-white/10 rounded px-2 py-1 text-xs text-white/80" />
    </div>
    <p className="text-[10px] text-white/40">Includes local Codex sessions started outside Command Center. Open to read or continue a conversation.</p>
    <button onClick={index} disabled={indexing} className="text-[10px] text-accent-amber disabled:opacity-40">{indexing ? 'Indexing knowledge and sessions…' : 'Update knowledge search index'}</button>
    {indexMessage && <p role="status" className="text-[10px] text-white/40">{indexMessage}</p>}
    {loading && <p className="text-xs text-white/40">Loading session history…</p>}
    {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}
    <div className="max-h-52 overflow-y-auto space-y-1">
      {visible.slice(0, 200).map(entry => <button key={entry.threadId} disabled={!!opening} onClick={() => open(entry)} className="block w-full text-left rounded p-2 hover:bg-surface-3 disabled:opacity-40">
        <p className="text-[11px] text-white/75 truncate">{opening === entry.threadId ? 'Opening…' : entry.title}</p>
        <p className="text-[9px] text-white/35 truncate">{entry.projectPath} · {new Date(entry.updatedAt).toLocaleString()}{sessions.some(s => s.threadId === entry.threadId && s.status === 'working') ? ' · working' : ''}</p>
      </button>)}
      {!loading && visible.length === 0 && <p className="text-xs text-white/40 py-2">No matching sessions.</p>}
    </div>
  </div>
}
