import { useState, useRef, useEffect, useCallback } from 'react'
import { useCommandCenterStore, CCQueueItem } from '../../store/commandCenterStore'
import { Button, Badge } from '../ui'
import {
  ChevronRight,
  Send,
  Check,
  Loader2,
  FileEdit,
  Terminal,
  X,
  Image,
  FileText,
  Film,
  File,
  Pause,
  AlertTriangle,
  Square,
} from 'lucide-react'
import ConfettiOverlay from './ConfettiOverlay'
import MCPDialog from './MCPDialog'
import { renderMarkdown } from '../../utils/markdown'
import type { FileAttachment } from '../../types'

const MODEL_LABELS: Record<string, string> = {
  'claude-opus-4-6': 'Opus',
  'claude-sonnet-4-5-20250929': 'Sonnet',
  'claude-haiku-4-5-20251001': 'Haiku',
}

function AttachmentChip({ att, onRemove }: { att: FileAttachment; onRemove: () => void }) {
  const Icon = att.type === 'image' ? Image : att.type === 'video' ? Film : att.type === 'text' ? FileText : File

  const color =
    att.type === 'image'
      ? 'text-accent-purple'
      : att.type === 'video'
        ? 'text-accent-rose'
        : att.type === 'text'
          ? 'text-accent-blue'
          : 'text-white/40'

  return (
    <div className="flex items-center gap-1.5 bg-surface-3 border border-white/[0.06] rounded-lg px-2 py-1 group">
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

export default function FocusCard({ item }: { item: CCQueueItem }) {
  const { respond, dismiss, park, kill } = useCommandCenterStore()
  const [response, setResponse] = useState('')
  const [showFiles, setShowFiles] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [dragging, setDragging] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [logEntries, setLogEntries] = useState<any[]>([])
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dragCountRef = useRef(0)
  const prevProcessId = useRef(item.processId)

  // Reset draft when the focused item changes to a different process
  useEffect(() => {
    if (item.processId !== prevProcessId.current) {
      setResponse('')
      setAttachments([])
      setShowFiles(false)
      setShowLog(false)
      setLogEntries([])
      setConfirmKill(false)
      prevProcessId.current = item.processId
    }
  }, [item.processId])

  useEffect(() => {
    if (item.status === 'awaiting_input') inputRef.current?.focus()
  }, [item.status, item.processId])

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a[data-external-link]') as HTMLAnchorElement | null
    if (link) {
      e.preventDefault()
      window.electronAPI.openExternal(link.href)
    }
  }, [])

  const buildResponseWithAttachments = (): string => {
    const parts: string[] = []

    for (const att of attachments) {
      if (att.type === 'text' && att.textContent) {
        parts.push(`[File: ${att.name}]\n\`\`\`\n${att.textContent}\n\`\`\``)
      } else if (att.type === 'image') {
        parts.push(`[Image attached: ${att.name} (${att.sizeKb}KB, ${att.mimeType})]`)
      } else if (att.type === 'video') {
        parts.push(`[Video file: ${att.name} (${att.sizeKb}KB, ${att.mimeType})]`)
      } else {
        parts.push(`[File: ${att.name} (${att.sizeKb}KB, ${att.mimeType})]`)
      }
    }

    if (response.trim()) {
      parts.push(response.trim())
    }

    return parts.join('\n\n')
  }

  const [shellOutput, setShellOutput] = useState<{
    command: string
    stdout: string
    stderr: string
    code: number
  } | null>(null)
  const [shellRunning, setShellRunning] = useState(false)

  const handleSlashCommand = async (cmd: string): Promise<boolean> => {
    const parts = cmd.slice(1).trim().split(/\s+/)
    const name = parts[0]?.toLowerCase()
    const arg = parts.slice(1).join(' ')

    const showResult = (command: string, stdout: string) => {
      setShellOutput({ command, stdout, stderr: '', code: 0 })
      setResponse('')
    }

    const runCli = async (command: string, label: string) => {
      setShellRunning(true)
      setResponse('')
      try {
        const result = await window.electronAPI.ccExecShell({ command, cwd: item.projectPath })
        setShellOutput({ command: label, ...result })
      } catch (err: any) {
        setShellOutput({ command: label, stdout: '', stderr: err.message, code: 1 })
      }
      setShellRunning(false)
    }

    if (name === 'mcp') {
      setMcpDialogOpen(true)
      setResponse('')
      return true
    }
    if (name === 'agents') {
      await runCli('claude agents', '/agents')
      return true
    }
    if (name === 'doctor') {
      await runCli('claude doctor', '/doctor')
      return true
    }

    if (name === 'effort') {
      const valid = ['low', 'medium', 'high', 'max']
      if (!arg || !valid.includes(arg)) {
        showResult(
          '/effort',
          `Usage: /effort <${valid.join('|')}>\nSets thinking level. Restarts session with new effort.`
        )
        return true
      }
      // Kill and relaunch with new effort
      const sessionId = item.sessionId
      const projectPath = item.projectPath
      kill(item.processId)
      setTimeout(() => {
        const { launch } = useCommandCenterStore.getState()
        launch(projectPath, 'Continue where we left off.', { effort: arg, resumeSessionId: sessionId || undefined })
      }, 500)
      setResponse('')
      return true
    }

    if (name === 'model') {
      const aliases: Record<string, string> = {
        sonnet: 'claude-sonnet-4-5-20250929',
        opus: 'claude-opus-4-6',
        haiku: 'claude-haiku-4-5-20251001',
      }
      const modelId = aliases[arg?.toLowerCase()] || arg
      if (!modelId) {
        showResult('/model', 'Usage: /model <sonnet|opus|haiku>\nSwitches model. Restarts session.')
        return true
      }
      const sessionId = item.sessionId
      const projectPath = item.projectPath
      kill(item.processId)
      setTimeout(() => {
        const { launch } = useCommandCenterStore.getState()
        launch(projectPath, 'Continue where we left off.', { model: modelId, resumeSessionId: sessionId || undefined })
      }, 500)
      setResponse('')
      return true
    }

    if (name === 'name') {
      if (!arg) {
        showResult('/name', 'Usage: /name <label>\nNames this session for easy identification.')
        return true
      }
      // Update the queue item's projectName display (cosmetic only)
      showResult('/name', `Session named: ${arg}`)
      return true
    }

    if (name === 'cost') {
      showResult(
        '/cost',
        `Session: $${item.costUsd.toFixed(4)}\nTurns: ${item.turnCount}\nFiles changed: ${item.filesChanged.length}`
      )
      return true
    }

    if (name === 'status') {
      const elapsed = Math.round((Date.now() - item.startedAt) / 60000)
      showResult(
        '/status',
        `Status: ${item.status}\nProject: ${item.projectName}\nSession: ${item.sessionId || 'pending'}\nCost: $${item.costUsd.toFixed(4)}\nTurns: ${item.turnCount}\nElapsed: ${elapsed}m\nFiles: ${item.filesChanged.join(', ') || 'none'}`
      )
      return true
    }

    if (name === 'clear') {
      kill(item.processId)
      setResponse('')
      return true
    }

    if (name === 'compact') {
      showResult(
        '/compact',
        'Context management is automatic in managed sessions.\nClaude compresses context when approaching limits.'
      )
      return true
    }

    if (name === 'help') {
      showResult(
        '/help',
        [
          'Session:',
          '  /effort <low|medium|high|max>  Set thinking level (restarts)',
          '  /model <sonnet|opus|haiku>     Switch model (restarts)',
          '  /name <label>                  Name this session',
          '  /cost                          Session cost and stats',
          '  /status                        Full session info',
          '  /clear                         Kill this session',
          '  /compact                       Context info',
          '',
          'CLI:',
          '  /mcp                           List MCP servers',
          '  /agents                        List configured agents',
          '  /doctor                        Claude Code health check',
          '',
          'Shell:',
          '  !command                       Run in project dir',
        ].join('\n')
      )
      return true
    }

    return false
  }

  const handleSend = async () => {
    const full = buildResponseWithAttachments()
    if (!full) return

    // Slash commands: / prefix
    if (full.startsWith('/')) {
      const handled = await handleSlashCommand(full)
      if (handled) return
    }

    // Shell command: ! prefix
    if (full.startsWith('!')) {
      const command = full.slice(1).trim()
      if (!command) return
      setShellRunning(true)
      setResponse('')
      try {
        const result = await window.electronAPI.ccExecShell({ command, cwd: item.projectPath })
        setShellOutput({ command, ...result })
      } catch (err: any) {
        setShellOutput({ command, stdout: '', stderr: err.message, code: 1 })
      }
      setShellRunning(false)
      return
    }

    respond(item.processId, full)
    setResponse('')
    setAttachments([])
  }

  const handleDone = () => {
    setShowConfetti(true)
    setTimeout(() => {
      dismiss(item.processId)
    }, 2000)
  }

  const handleKill = () => {
    if (!confirmKill) {
      setConfirmKill(true)
      return
    }
    kill(item.processId)
    setConfirmKill(false)
  }

  const [fileError, setFileError] = useState<string | null>(null)

  const processDroppedFiles = async (files: FileList) => {
    setLoadingFiles(true)
    setFileError(null)
    const newAttachments: FileAttachment[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const filePath = (file as any).path as string
      if (!filePath) continue

      // Reject files over 5MB before even reading
      if (file.size > 5 * 1024 * 1024) {
        setFileError(`${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB per file.`)
        continue
      }

      try {
        const att = await window.electronAPI.codexReadFileForChat({ filePath })
        newAttachments.push(att)
      } catch (err: any) {
        setFileError(`Failed to read ${file.name}: ${err.message}`)
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments])
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

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const blob = items[i].getAsFile()
        if (!blob) continue
        const mimeType = blob.type
        const ext = mimeType.split('/')[1] || 'png'
        const name = `pasted-image.${ext}`
        const arrayBuf = await blob.arrayBuffer()
        const bytes = new Uint8Array(arrayBuf)
        let binary = ''
        for (let j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j])
        const base64 = btoa(binary)
        setAttachments((prev) => [
          ...prev,
          {
            type: 'image',
            name,
            mimeType,
            sizeKb: Math.round(bytes.length / 1024),
            base64,
          },
        ])
        return
      }
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  // Re-render every 30s to keep elapsed timers fresh
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const idleMinutes = Math.floor((Date.now() - item.lastActivityAt) / 60000)
  const isStale = item.status === 'working' && idleMinutes >= 5

  const statusColor = {
    working: isStale ? 'text-accent-amber' : 'text-accent-emerald',
    awaiting_input: 'text-accent-amber',
    errored: 'text-accent-red',
  }[item.status]

  const statusLabel = {
    working: isStale ? `No output ${idleMinutes}m` : 'Working...',
    awaiting_input: 'Awaiting input',
    errored: 'Error',
  }[item.status]

  const displayText = item.status === 'errored' ? item.errorMessage || 'Unknown error' : item.resultText || item.prompt

  // Truncate display
  const truncated = false
  const shownText = displayText
  const [showFullText, setShowFullText] = useState(false)

  // Estimate total message size (text content + base64 images)
  const estimatedSizeBytes = (() => {
    let total = response.length
    for (const att of attachments) {
      if (att.type === 'text' && att.textContent) total += att.textContent.length
      else if (att.base64)
        total += att.base64.length * 0.75 // base64 → bytes
      else total += att.sizeKb * 1024
    }
    return total
  })()
  const MAX_MESSAGE_BYTES = 5 * 1024 * 1024 // 5MB — well under Claude's 20MB limit
  const isOversized = estimatedSizeBytes > MAX_MESSAGE_BYTES

  const canSend = (response.trim() || attachments.length > 0) && !isOversized

  return (
    <div className="relative">
      {showConfetti && <ConfettiOverlay color={item.projectColor} onDone={() => setShowConfetti(false)} />}
      <div
        className={`bg-surface-1 border rounded-xl p-4 ${
          item.status === 'awaiting_input'
            ? 'border-accent-amber/30'
            : item.status === 'errored'
              ? 'border-accent-red/30'
              : 'border-white/[0.06]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={
                (['blue', 'purple', 'red', 'amber'] as const).includes(item.projectColor as any)
                  ? (item.projectColor as 'blue' | 'purple' | 'red' | 'amber')
                  : item.projectColor === 'green'
                    ? 'emerald'
                    : 'default'
              }
            >
              {item.projectName}
            </Badge>
            <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
            {item.status === 'working' && !isStale && (
              <Loader2 size={10} className="text-accent-emerald animate-spin" />
            )}
            {isStale && <AlertTriangle size={10} className="text-accent-amber" />}
            {(item.model || item.effort) && (
              <div className="flex items-center gap-1">
                {item.model && (
                  <span className="bg-surface-2 border border-white/[0.06] rounded-md px-1.5 py-0.5 text-[10px] text-white/40 font-mono">
                    {MODEL_LABELS[item.model] ?? item.model.slice(0, 12)}
                  </span>
                )}
                {item.effort && (
                  <span className="bg-surface-2 border border-white/[0.06] rounded-md px-1.5 py-0.5 text-[10px] text-white/40 font-mono">
                    {item.effort.charAt(0).toUpperCase() + item.effort.slice(1)}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/30">${item.costUsd.toFixed(2)}</span>
            <span className="text-[9px] text-white/20">{Math.round((Date.now() - item.startedAt) / 60000)}m ago</span>
          </div>
        </div>

        {/* Result text */}
        <div
          className="text-[12px] text-white/80 mb-3 leading-relaxed select-text cursor-text"
          onClick={handleLinkClick}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(showFullText ? displayText : shownText) }}
        />
        {truncated && !showFullText && (
          <button onClick={() => setShowFullText(true)} className="text-accent-blue text-[10px] mb-3">
            Show more
          </button>
        )}

        {/* Expand toggles */}
        <div className="flex items-center gap-3 mb-3 text-[10px]">
          {item.filesChanged.length > 0 && (
            <button
              onClick={() => setShowFiles(!showFiles)}
              className="text-white/40 hover:text-white/60 flex items-center gap-1"
            >
              <ChevronRight size={10} className={`transition-transform ${showFiles ? 'rotate-90' : ''}`} />
              Files changed ({item.filesChanged.length})
            </button>
          )}
          <button
            onClick={async () => {
              if (!showLog) {
                const log = await window.electronAPI.ccGetLog({ processId: item.processId })
                setLogEntries(log)
              }
              setShowLog(!showLog)
            }}
            className="text-white/40 hover:text-white/60 flex items-center gap-1"
          >
            <ChevronRight size={10} className={`transition-transform ${showLog ? 'rotate-90' : ''}`} />
            Full log
          </button>
        </div>

        {/* Expanded: Files */}
        {showFiles && (
          <div className="bg-surface-0 rounded-lg p-3 mb-3 space-y-1">
            {item.filesChanged.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-white/50">
                <FileEdit size={10} /> {f}
              </div>
            ))}
          </div>
        )}

        {/* Expanded: Log (fetched on demand) */}
        {showLog && (
          <div className="bg-surface-0 rounded-lg p-3 mb-3 max-h-64 overflow-y-auto space-y-2">
            {logEntries.length === 0 ? (
              <p className="text-[10px] text-white/30">No log entries.</p>
            ) : (
              logEntries.map((msg, i) => (
                <div
                  key={i}
                  className={`text-[10px] ${
                    msg.type === 'assistant'
                      ? 'text-white/70'
                      : msg.type === 'tool_use'
                        ? 'text-accent-cyan/70 font-mono'
                        : 'text-white/40'
                  }`}
                >
                  {msg.type === 'tool_use' ? (
                    <span>
                      <Terminal size={9} className="inline mr-1" />
                      {msg.toolName}: {msg.toolInput?.slice(0, 100)}
                    </span>
                  ) : (
                    msg.text?.slice(0, 300)
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Stale warning banner */}
        {isStale && (
          <div className="flex items-center justify-between mb-2 px-3 py-2 rounded-lg bg-accent-amber/5 border border-accent-amber/15">
            <div className="flex items-center gap-2">
              <AlertTriangle size={10} className="text-accent-amber flex-shrink-0" />
              <span className="text-[10px] text-accent-amber/80">No output for {idleMinutes}m — may be stuck</span>
            </div>
            <button
              onClick={() => park(item.processId)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent-amber/15 text-accent-amber text-[10px] font-accent hover:bg-accent-amber/25 transition-all"
            >
              <Square size={8} /> Stop
            </button>
          </div>
        )}

        {/* Shell output */}
        {shellRunning && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-surface-0 border border-white/[0.06]">
            <Loader2 size={10} className="text-accent-cyan animate-spin" />
            <span className="text-[10px] text-white/50 font-mono">Running...</span>
          </div>
        )}
        {shellOutput && !shellRunning && (
          <div className="mb-2 rounded-lg bg-surface-0 border border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.04]">
              <span className="text-[9px] text-accent-cyan font-mono">$ {shellOutput.command}</span>
              <button onClick={() => setShellOutput(null)} className="text-white/20 hover:text-white/40">
                <X size={10} />
              </button>
            </div>
            <pre className="px-3 py-2 text-[10px] font-mono leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
              {shellOutput.stdout && <span className="text-white/70">{shellOutput.stdout}</span>}
              {shellOutput.stderr && <span className="text-accent-red/70">{shellOutput.stderr}</span>}
              {!shellOutput.stdout && !shellOutput.stderr && <span className="text-white/30">(no output)</span>}
            </pre>
            {shellOutput.code !== 0 && (
              <div className="px-3 py-1 border-t border-white/[0.04] text-[9px] text-accent-red/60 font-mono">
                exit {shellOutput.code}
              </div>
            )}
          </div>
        )}

        {/* Pending input indicator */}
        {item.pendingInput && item.status === 'working' && !isStale && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-accent-blue/5 border border-accent-blue/10">
            <Loader2 size={10} className="text-accent-blue animate-spin flex-shrink-0" />
            <span className="text-[10px] text-accent-blue/70">Queued — will run after current turn:</span>
            <span className="text-[10px] text-white/50 truncate">{item.pendingInput.slice(0, 80)}</span>
          </div>
        )}

        {/* Response input with drag-and-drop */}
        {(item.status === 'awaiting_input' || item.status === 'working') && (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="relative"
          >
            {/* Drag overlay */}
            {dragging && (
              <div className="absolute inset-0 z-10 rounded-lg border-2 border-dashed border-accent-blue/50 bg-accent-blue/5 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-1">
                  <File size={20} className="text-accent-blue/60" />
                  <span className="text-[11px] text-accent-blue/70 font-accent">Drop files here</span>
                </div>
              </div>
            )}

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

            {fileError && (
              <div className="flex items-center gap-2 mb-2 text-[10px] text-accent-red/80">
                <AlertTriangle size={10} className="flex-shrink-0" />
                {fileError}
              </div>
            )}

            {isOversized && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-accent-red/5 border border-accent-red/15">
                <AlertTriangle size={10} className="text-accent-red flex-shrink-0" />
                <span className="text-[10px] text-accent-red/80">
                  Message too large ({(estimatedSizeBytes / 1024 / 1024).toFixed(1)}MB) — remove files or use smaller
                  ones (max 5MB)
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] text-white/25">Replying to</span>
              <span className="text-[9px] text-white/50 font-accent">{item.projectName}</span>
            </div>
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                onPaste={handlePaste}
                placeholder={
                  attachments.length > 0
                    ? 'Add a message (optional)...'
                    : 'Type prompt, /help, !shell, or drop files...'
                }
                className="flex-1 bg-surface-0 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 placeholder-white/20 focus:outline-none focus:border-accent-blue/40 resize-none min-h-[36px] max-h-[120px]"
                rows={1}
              />
              <Button variant="primary" size="sm" onClick={handleSend} disabled={!canSend}>
                <Send size={12} />
              </Button>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
          <button onClick={handleKill} className="text-[10px] text-white/20 hover:text-accent-red transition-colors">
            {confirmKill ? 'Confirm kill?' : 'Kill'}
          </button>
          <div className="flex items-center gap-2">
            {(item.status === 'awaiting_input' || item.status === 'working') && (
              <Button variant="ghost" size="xs" onClick={() => park(item.processId)}>
                <Pause size={10} /> Park
              </Button>
            )}
            {item.status === 'awaiting_input' && (
              <Button variant="ghost" size="xs" onClick={handleDone}>
                <Check size={10} /> Done
              </Button>
            )}
          </div>
        </div>
      </div>
      <MCPDialog open={mcpDialogOpen} onClose={() => setMcpDialogOpen(false)} projectPath={item.projectPath ?? ''} />
    </div>
  )
}
