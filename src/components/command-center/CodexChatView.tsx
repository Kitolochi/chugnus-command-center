import { useEffect, useRef, useState } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { renderMarkdown } from '../../utils/markdown'
import { Send, Trash2, FolderOpen, FileCode, Loader2 } from 'lucide-react'

export default function CodexChatView() {
  const {
    codexMessages, codexProject, codexProjectTree, codexLoading, projects,
    codexSend, codexSetProject, codexClear, codexAttachFile, loadProjects,
  } = useCommandCenterStore()

  const [input, setInput] = useState('')
  const [filePath, setFilePath] = useState('')
  const [showFilePicker, setShowFilePicker] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [codexMessages.length, codexLoading])

  const handleSend = async () => {
    if (!input.trim() || codexLoading) return
    const msg = input.trim()
    setInput('')
    await codexSend(msg)
  }

  const handleAttachFile = async () => {
    if (!filePath.trim()) return
    await codexAttachFile(filePath.trim())
    setFilePath('')
    setShowFilePicker(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-amber" />
          <h3 className="text-[13px] font-semibold text-white/80 font-accent tracking-tight">Codex 5.4</h3>
          {codexProject && (
            <span className="px-2 py-0.5 bg-surface-3 rounded text-[9px] text-white/40 font-mono">
              {codexProject.split(/[/\\]/).pop()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Project selector */}
          <select
            value={codexProject || ''}
            onChange={(e) => codexSetProject(e.target.value || null)}
            className="bg-surface-2 border border-white/10 rounded px-2 py-1 text-[10px] text-white/60 focus:outline-none max-w-[200px]"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.path} value={p.path}>{p.name}</option>
            ))}
          </select>

          {/* Attach file */}
          <button
            onClick={() => setShowFilePicker(!showFilePicker)}
            className="p-1.5 bg-surface-2 border border-white/10 rounded text-white/40 hover:text-white/70 transition-colors"
            title="Attach file"
          >
            <FileCode size={12} />
          </button>

          {/* Clear */}
          <button
            onClick={codexClear}
            className="p-1.5 bg-surface-2 border border-white/10 rounded text-white/40 hover:text-accent-red transition-colors"
            title="Clear conversation"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* File picker */}
      {showFilePicker && (
        <div className="flex-shrink-0 flex items-center gap-2 mb-2 p-2 bg-surface-2 rounded-lg border border-white/5">
          <FileCode size={12} className="text-white/30 shrink-0" />
          <input
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAttachFile() }}
            placeholder="Full file path to attach..."
            className="flex-1 bg-transparent text-[11px] text-white/80 placeholder:text-white/30 focus:outline-none font-mono"
          />
          <button
            onClick={handleAttachFile}
            disabled={!filePath.trim()}
            className="px-2 py-0.5 bg-accent-amber/20 text-accent-amber rounded text-[10px] hover:bg-accent-amber/30 disabled:opacity-30 transition-colors"
          >
            Attach
          </button>
        </div>
      )}

      {/* Project tree context indicator */}
      {codexProject && codexProjectTree && codexMessages.length === 0 && (
        <div className="flex-shrink-0 mb-3 p-3 bg-surface-1 rounded-lg border border-white/5">
          <div className="flex items-center gap-2 mb-1.5">
            <FolderOpen size={12} className="text-accent-amber" />
            <span className="text-[10px] text-white/50 font-medium">Project loaded</span>
          </div>
          <pre className="text-[9px] text-white/30 font-mono max-h-32 overflow-y-auto leading-relaxed">
            {codexProjectTree.slice(0, 2000)}
          </pre>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {codexMessages.length === 0 && !codexProject && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-10 h-10 rounded-full bg-accent-amber/10 flex items-center justify-center mb-3">
              <span className="text-accent-amber text-lg font-accent font-bold">G</span>
            </div>
            <p className="text-[12px] text-white/50 font-accent">GPT 5.4 Codex</p>
            <p className="text-[10px] text-white/30 mt-1 max-w-xs">
              Review repos, architecture, code quality. Select a project for context or just start chatting.
            </p>
          </div>
        )}

        {codexMessages.map((msg, i) => {
          const isUser = msg.role === 'user'
          const isFileAttach = isUser && msg.content.startsWith('[File:')
          const isProjectContext = isUser && msg.content.startsWith('[Project context:')

          if (isProjectContext) return null // Don't render project context messages

          return (
            <div key={i} className={`${isUser ? 'ml-8' : 'mr-4'}`}>
              {isUser ? (
                <div className={`rounded-lg p-2.5 ${isFileAttach ? 'bg-surface-2 border border-white/5' : 'bg-accent-blue/10 border border-accent-blue/20'}`}>
                  {isFileAttach ? (
                    <div>
                      <span className="text-[9px] text-accent-amber font-mono font-medium">
                        {msg.content.match(/\[File: (.+?)\]/)?.[1] || 'file'}
                      </span>
                      <pre className="text-[9px] text-white/40 font-mono mt-1 max-h-20 overflow-y-auto">
                        {msg.content.replace(/\[File: .+?\]\n```\n?/, '').replace(/\n?```$/, '').slice(0, 500)}
                        {msg.content.length > 500 ? '...' : ''}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-[12px] text-white/80">{msg.content}</p>
                  )}
                </div>
              ) : (
                <div className="border-l-2 border-accent-amber pl-3 py-1">
                  <span className="text-[9px] font-semibold text-accent-amber font-accent">Codex 5.4</span>
                  <div
                    className="text-[12px] text-white/80 leading-relaxed mt-1 [&_pre]:my-1.5 [&_pre]:bg-surface-3 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:text-[10px] [&_pre]:font-mono [&_code]:text-[10px] [&_code]:font-mono"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                </div>
              )}
            </div>
          )
        })}

        {codexLoading && (
          <div className="flex items-center gap-2 pl-3 py-2 text-[11px] text-white/30">
            <Loader2 size={12} className="animate-spin text-accent-amber" />
            Codex thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 mt-3 pt-3 border-t border-white/5">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={codexProject ? `Ask Codex about ${codexProject.split(/[/\\]/).pop()}...` : 'Ask Codex anything...'}
            className="flex-1 bg-surface-2 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-accent-amber/50"
            rows={2}
            disabled={codexLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || codexLoading}
            className="self-end px-3 py-2 bg-accent-amber/20 text-accent-amber rounded-lg text-[11px] font-medium hover:bg-accent-amber/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
