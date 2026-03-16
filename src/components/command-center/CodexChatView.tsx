import { useEffect, useRef, useState } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { useVoiceStore } from '../../store/voiceStore'
import { renderMarkdown } from '../../utils/markdown'
import { speakText, cancelSpeech } from '../../utils/tts'
import { Send, Trash2, FolderOpen, FileCode, Loader2, X, Image, FileText, Film, File } from 'lucide-react'
import type { FileAttachment } from '../../types'

function AttachmentChip({ att, onRemove }: { att: FileAttachment; onRemove: () => void }) {
  const Icon = att.type === 'image' ? Image
    : att.type === 'video' ? Film
    : att.type === 'text' ? FileText
    : File

  const color = att.type === 'image' ? 'text-accent-purple'
    : att.type === 'video' ? 'text-accent-rose'
    : att.type === 'text' ? 'text-accent-blue'
    : 'text-white/40'

  return (
    <div className="flex items-center gap-1.5 bg-surface-3 border border-white/[0.06] rounded-lg px-2 py-1">
      <Icon size={10} className={color} />
      <span className="text-[9px] text-white/60 font-mono max-w-[120px] truncate">{att.name}</span>
      <span className="text-[8px] text-white/25 font-mono">{att.sizeKb}k</span>
      {att.type === 'image' && att.base64 && (
        <img
          src={`data:${att.mimeType};base64,${att.base64}`}
          alt={att.name}
          className="w-6 h-6 rounded object-cover border border-white/10"
        />
      )}
      <button onClick={onRemove} className="text-white/20 hover:text-accent-red transition-colors ml-0.5">
        <X size={8} />
      </button>
    </div>
  )
}

export default function CodexChatView() {
  const {
    codexMessages, codexProject, codexProjectTree, codexLoading, projects,
    codexSend, codexSetProject, codexClear, codexAttachFile, loadProjects,
  } = useCommandCenterStore()

  const [input, setInput] = useState('')
  const [filePath, setFilePath] = useState('')
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [dragging, setDragging] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragCountRef = useRef(0)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [codexMessages.length, codexLoading])

  // Auto-TTS: speak new assistant messages
  const prevMsgCountRef = useRef(codexMessages.length)
  const { autoTtsEnabled, setSpeaking, lastTranscription, setLastTranscription } = useVoiceStore()

  useEffect(() => {
    if (!autoTtsEnabled) return
    if (codexMessages.length <= prevMsgCountRef.current) {
      prevMsgCountRef.current = codexMessages.length
      return
    }
    prevMsgCountRef.current = codexMessages.length

    const last = codexMessages[codexMessages.length - 1]
    if (last?.role === 'assistant') {
      cancelSpeech()
      setSpeaking(true)
      speakText(last.content, () => setSpeaking(false), () => setSpeaking(false))
    }
  }, [codexMessages.length, autoTtsEnabled])

  // Voice transcription injection: when lastTranscription changes, inject into chat
  useEffect(() => {
    if (!lastTranscription) return
    const text = lastTranscription
    setLastTranscription('')
    setInput(text)
    // Auto-submit after a tick so the input state updates
    setTimeout(() => {
      codexSend(text)
      setInput('')
    }, 50)
  }, [lastTranscription])

  const handleSend = async () => {
    if (codexLoading) return
    if (!input.trim() && attachments.length === 0) return

    // Build message with attachments
    const parts: string[] = []
    for (const att of attachments) {
      if (att.type === 'text' && att.textContent) {
        parts.push(`[File: ${att.name}]\n\`\`\`\n${att.textContent}\n\`\`\``)
      } else if (att.type === 'image') {
        parts.push(`[Image: ${att.name} (${att.sizeKb}KB, ${att.mimeType})]`)
      } else if (att.type === 'video') {
        parts.push(`[Video: ${att.name} (${att.sizeKb}KB, ${att.mimeType})]`)
      } else {
        parts.push(`[File: ${att.name} (${att.sizeKb}KB, ${att.mimeType})]`)
      }
    }
    if (input.trim()) parts.push(input.trim())

    const msg = parts.join('\n\n')
    setInput('')
    setAttachments([])
    await codexSend(msg)
  }

  const handleAttachFile = async () => {
    if (!filePath.trim()) return
    await codexAttachFile(filePath.trim())
    setFilePath('')
    setShowFilePicker(false)
  }

  const processDroppedFiles = async (files: FileList) => {
    setLoadingFiles(true)
    const newAttachments: FileAttachment[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fp = (file as any).path as string
      if (!fp) continue

      try {
        const att = await window.electronAPI.codexReadFileForChat({ filePath: fp })
        newAttachments.push(att)
      } catch (err: any) {
        console.error(`Failed to read ${fp}:`, err)
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments])
    }
    setLoadingFiles(false)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current++
    if (dragCountRef.current === 1) setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current--
    if (dragCountRef.current === 0) setDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current = 0
    setDragging(false)

    if (e.dataTransfer.files.length > 0) {
      processDroppedFiles(e.dataTransfer.files)
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div
      className="flex flex-col h-[calc(100vh-140px)]"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Global drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-20 rounded-lg border-2 border-dashed border-accent-amber/50 bg-accent-amber/5 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-1.5">
            <File size={24} className="text-accent-amber/60" />
            <span className="text-[12px] text-accent-amber/70 font-accent">Drop files to attach</span>
            <span className="text-[9px] text-white/30">Images, code, text, videos</span>
          </div>
        </div>
      )}

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
              Review repos, architecture, code quality. Select a project for context, drop files, or just start chatting.
            </p>
          </div>
        )}

        {codexMessages.map((msg, i) => {
          const isUser = msg.role === 'user'
          const isFileAttach = isUser && msg.content.startsWith('[File:')
          const isImageAttach = isUser && msg.content.startsWith('[Image:')
          const isProjectContext = isUser && msg.content.startsWith('[Project context:')

          if (isProjectContext) return null // Don't render project context messages

          return (
            <div key={i} className={`${isUser ? 'ml-8' : 'mr-4'}`}>
              {isUser ? (
                <div className={`rounded-lg p-2.5 ${isFileAttach || isImageAttach ? 'bg-surface-2 border border-white/5' : 'bg-accent-blue/10 border border-accent-blue/20'}`}>
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
                  ) : isImageAttach ? (
                    <div className="flex items-center gap-2">
                      <Image size={12} className="text-accent-purple" />
                      <span className="text-[10px] text-white/60">{msg.content}</span>
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

      {/* Input with attachments */}
      <div className="flex-shrink-0 mt-3 pt-3 border-t border-white/5">
        {/* Staged attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.map((att, i) => (
              <AttachmentChip key={i} att={att} onRemove={() => removeAttachment(i)} />
            ))}
          </div>
        )}

        {loadingFiles && (
          <div className="flex items-center gap-2 mb-2 text-[10px] text-white/40">
            <Loader2 size={10} className="animate-spin" />
            Reading files...
          </div>
        )}

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
            placeholder={attachments.length > 0 ? 'Add a message (optional)...' : codexProject ? `Ask Codex about ${codexProject.split(/[/\\]/).pop()}...` : 'Ask Codex anything or drop files...'}
            className="flex-1 bg-surface-2 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-accent-amber/50"
            rows={2}
            disabled={codexLoading}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && attachments.length === 0) || codexLoading}
            className="self-end px-3 py-2 bg-accent-amber/20 text-accent-amber rounded-lg text-[11px] font-medium hover:bg-accent-amber/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
