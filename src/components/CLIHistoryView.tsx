import { useState, useEffect, useCallback } from 'react'
import { CLISession, CLISessionMessage } from '../types'

export default function CLIHistoryView() {
  const [sessions, setSessions] = useState<CLISession[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ sessionId: string; firstPrompt: string; matches: string[] }[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [sessionMessages, setSessionMessages] = useState<CLISessionMessage[]>([])
  const [messagesOffset, setMessagesOffset] = useState(0)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const s = await window.electronAPI.getCliSessions()
      setSessions(s)
    } catch {
      setSessions([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    try {
      const results = await window.electronAPI.searchCliSessions(searchQuery.trim())
      setSearchResults(results)
    } catch {
      setSearchResults([])
    }
    setSearching(false)
  }

  const handleExpandSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
      setSessionMessages([])
      return
    }
    setExpandedSession(sessionId)
    setSessionMessages([])
    setMessagesOffset(0)
    setLoadingMessages(true)
    try {
      const result = await window.electronAPI.getCliSessionMessages(sessionId, 0, 50)
      setSessionMessages(result.messages)
      setHasMoreMessages(result.hasMore)
      setMessagesOffset(50)
    } catch {
      setSessionMessages([])
    }
    setLoadingMessages(false)
  }

  const handleLoadMore = async () => {
    if (!expandedSession || loadingMessages) return
    setLoadingMessages(true)
    try {
      const result = await window.electronAPI.getCliSessionMessages(expandedSession, messagesOffset, 50)
      setSessionMessages(prev => [...prev, ...result.messages])
      setHasMoreMessages(result.hasMore)
      setMessagesOffset(prev => prev + 50)
    } catch {}
    setLoadingMessages(false)
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays}d ago`
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="h-full flex flex-col p-3">
      {/* Search */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          placeholder="Search CLI sessions..."
          className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[11px] text-white/90 focus:outline-none focus:border-accent-blue/40 placeholder-muted/40"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-3 py-1.5 bg-surface-3 hover:bg-surface-4 rounded-lg text-[11px] text-white/70 transition-all disabled:opacity-50"
        >
          {searching ? '...' : 'Search'}
        </button>
        {searchResults !== null && (
          <button
            onClick={() => { setSearchResults(null); setSearchQuery('') }}
            className="px-2 py-1.5 rounded-lg text-[11px] text-muted hover:text-white transition-all"
          >
            Clear
          </button>
        )}
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-auto space-y-1">
        {loading ? (
          <div className="text-center py-8">
            <span className="text-[11px] text-muted/60">Loading sessions...</span>
          </div>
        ) : searchResults !== null ? (
          searchResults.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-[11px] text-muted/60">No matches found</span>
            </div>
          ) : (
            searchResults.map(sr => (
              <div key={sr.sessionId} className="bg-surface-2 rounded-lg p-2.5 cursor-pointer hover:bg-surface-3 transition-all"
                onClick={() => handleExpandSession(sr.sessionId)}
              >
                <div className="text-[11px] text-white/80 truncate">{sr.firstPrompt || 'Untitled session'}</div>
                {sr.matches.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {sr.matches.slice(0, 3).map((m, i) => (
                      <div key={i} className="text-[10px] text-muted/60 truncate">...{m}...</div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[11px] text-muted/60">No CLI sessions found</p>
            <p className="text-[10px] text-muted/40 mt-1">Sessions from ~/.claude/projects/ will appear here</p>
          </div>
        ) : (
          sessions.map(s => (
            <div key={s.sessionId}>
              <div
                className={`rounded-lg p-2.5 cursor-pointer transition-all ${
                  expandedSession === s.sessionId ? 'bg-surface-3' : 'bg-surface-2 hover:bg-surface-3'
                }`}
                onClick={() => handleExpandSession(s.sessionId)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/80 truncate flex-1">{s.firstPrompt || 'Untitled session'}</span>
                  <span className="text-[10px] text-muted/50 ml-2 shrink-0">{formatDate(s.modified)}</span>
                </div>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[10px] text-muted/40">{s.messageCount} messages</span>
                  <span className="text-[10px] text-muted/40 truncate">{s.project}</span>
                </div>
              </div>

              {/* Expanded messages */}
              {expandedSession === s.sessionId && (
                <div className="mt-1 ml-2 border-l-2 border-white/[0.06] pl-3 space-y-2 py-2">
                  {loadingMessages && sessionMessages.length === 0 ? (
                    <span className="text-[10px] text-muted/50">Loading messages...</span>
                  ) : (
                    <>
                      {sessionMessages.map((msg, i) => (
                        <div key={i} className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                          msg.type === 'user'
                            ? 'bg-accent-blue/10 text-white/80'
                            : 'bg-surface-2 text-white/70'
                        }`}>
                          <div className="text-[9px] text-muted/40 mb-0.5 font-medium uppercase">
                            {msg.type}
                          </div>
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        </div>
                      ))}
                      {hasMoreMessages && (
                        <button
                          onClick={e => { e.stopPropagation(); handleLoadMore() }}
                          disabled={loadingMessages}
                          className="w-full py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-[10px] text-muted hover:text-white/70 transition-all disabled:opacity-50"
                        >
                          {loadingMessages ? 'Loading...' : 'Load more'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
