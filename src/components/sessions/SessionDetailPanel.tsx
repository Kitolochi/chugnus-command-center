import { useEffect, useState } from 'react'
import { useSessionsStore } from '../../store'
import { renderMarkdown } from '../../utils/markdown'

export default function SessionDetailPanel() {
  const {
    sessionDetail, sessionMessages, loadingDetail, selectSession,
    sessionChildren, loadSessionChildren, exportSession,
  } = useSessionsStore()
  const [exporting, setExporting] = useState(false)

  // Load children when session changes
  useEffect(() => {
    if (sessionDetail?.id) {
      loadSessionChildren(sessionDetail.id)
    }
  }, [sessionDetail?.id, loadSessionChildren])

  const handleExport = async () => {
    if (!sessionDetail) return
    setExporting(true)
    try {
      const html = await exportSession(sessionDetail.id)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${sessionDetail.id.slice(0, 8)}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setExporting(false)
  }

  if (loadingDetail) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!sessionDetail) return null

  const duration = sessionDetail.ended_at && sessionDetail.started_at
    ? Math.round((new Date(sessionDetail.ended_at).getTime() - new Date(sessionDetail.started_at).getTime()) / 60000)
    : null

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-white/80 line-clamp-2 mb-2">
            {sessionDetail.first_message}
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] text-muted">
            <span className="text-accent-blue">{sessionDetail.project}</span>
            <span>{sessionDetail.message_count} messages ({sessionDetail.user_message_count} user)</span>
            {duration !== null && <span>{duration}m duration</span>}
            <span>{new Date(sessionDetail.started_at).toLocaleString()}</span>
            {sessionDetail.parent_session_id && (
              <button
                onClick={() => selectSession(sessionDetail.parent_session_id)}
                className="text-accent-purple hover:underline"
              >
                parent session
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-3 shrink-0">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="p-1.5 text-muted hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-50"
            title="Export as HTML"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={() => selectSession(null)}
            className="p-1.5 text-muted hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      {sessionMessages?.messages && sessionMessages.messages.length > 0 && (
        <div className="max-h-[600px] overflow-y-auto">
          {sessionMessages.messages.map((msg) => (
            <div
              key={msg.id}
              className={`px-5 py-3 border-b border-white/[0.03] ${
                msg.role === 'user' ? 'bg-white/[0.02]' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-medium uppercase tracking-wider ${
                  msg.role === 'user' ? 'text-accent-blue' : 'text-accent-purple'
                }`}>
                  {msg.role}
                </span>
                <span className="text-[10px] text-muted">#{msg.ordinal}</span>
              </div>
              <div
                className="prose prose-invert prose-sm max-w-none text-white/70 [&_p]:text-xs [&_li]:text-xs [&_code]:text-accent-blue [&_code]:bg-white/[0.04] [&_code]:px-1 [&_code]:rounded [&_pre]:bg-white/[0.04] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(
                    msg.content.length > 2000
                      ? msg.content.slice(0, 2000) + '\n\n*...truncated...*'
                      : msg.content
                  ),
                }}
              />
            </div>
          ))}
          {sessionMessages.count > sessionMessages.messages.length && (
            <div className="px-5 py-3 text-center text-xs text-muted">
              Showing {sessionMessages.messages.length} of {sessionMessages.count} messages
            </div>
          )}
        </div>
      )}

      {/* Continuations (child sessions) */}
      {sessionChildren && sessionChildren.length > 0 && (
        <div className="border-t border-white/[0.06] p-5">
          <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
            Continuations ({sessionChildren.length})
          </h4>
          <div className="space-y-2">
            {sessionChildren.map((child) => (
              <button
                key={child.id}
                onClick={() => selectSession(child.id)}
                className="w-full text-left flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-accent-purple mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-white/70 truncate">{child.first_message.slice(0, 80)}</div>
                  <div className="flex gap-3 mt-0.5 text-[10px] text-muted">
                    <span>{child.message_count} msgs</span>
                    <span>{new Date(child.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
