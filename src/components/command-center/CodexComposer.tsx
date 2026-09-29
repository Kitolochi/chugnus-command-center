import { useCodexImagePaste } from '../../hooks/useCodexImagePaste'
import CodexAttachments from './CodexAttachments'
import { CodexModelSelect, CodexEffortSelect } from './CodexModelControls'
import { useCodexModelSelection, effortForModel } from '../../hooks/useCodexModelSelection'
import { Button } from '../ui'
import { useRef, useState } from 'react'
import { FolderOpen, Paperclip, Send, Square, X } from 'lucide-react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { useCodexStore } from '../../store/codexStore'
import { useSessionCollapse } from '../../hooks/useSessionCollapse'
import type { CodexAccess, CodexSession } from '../../types/codex'

const fieldClass =
  'bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 min-w-0 focus:outline-none focus:border-accent-blue/40'

export default function CodexComposer({ session }: { session?: CodexSession }) {
  const [queueCollapsed, toggleQueue] = useSessionCollapse(session?.id || 'new', 'pending')
  const { projects, selectedProject, loadProjects } = useCommandCenterStore()
  const { send, stop, sending } = useCodexStore()
  const [projectPath, setProjectPath] = useState(session?.projectPath || selectedProject || '')
  const [model, setModel] = useState(session?.model || '')
  const [effort, setEffort] = useState(session?.effort || '')
  const selection = useCodexModelSelection(projectPath, model, effort)
  const [access, setAccess] = useState<CodexAccess>(session?.access || 'workspace-write')
  const [compatibility, setCompatibility] = useState(
    session?.windowsSandbox === 'unelevated' || localStorage.getItem('codex-windows-compatibility') === 'true'
  )
  const draftId = session?.id || 'new'
  const draft = useCodexStore((state) => state.drafts[draftId])
  const input = draft?.input || ''
  const files = draft?.files || []
  const submitting = useRef(false)
  const setInput = (value: string | ((previous: string) => string)) => {
    const current = useCodexStore.getState().drafts[draftId] || { input: '', files: [] }
    useCodexStore
      .getState()
      .setDraft(draftId, { ...current, input: typeof value === 'function' ? value(current.input) : value })
  }
  const setFiles = (value: string[] | ((previous: string[]) => string[])) => {
    const current = useCodexStore.getState().drafts[draftId] || { input: '', files: [] }
    useCodexStore
      .getState()
      .setDraft(draftId, { ...current, files: typeof value === 'function' ? value(current.files) : value })
  }
  const [error, setError] = useState('')
  const imagePaste = useCodexImagePaste(
    (pasted) => setFiles((current) => [...new Set([...current, ...pasted])]),
    setError
  )
  const working = session?.status === 'working'
  const locked = sending

  const browse = async () => {
    try {
      const project = await window.electronAPI.ccBrowseProject()
      if (project) {
        setProjectPath(project.path)
        await loadProjects()
      }
    } catch (err) {
      setError(String(err))
    }
  }
  const attach = async () => {
    try {
      const picked = await window.electronAPI.codexPickFiles()
      setFiles((prev) => [...new Set([...prev, ...picked])])
    } catch (err) {
      setError(String(err))
    }
  }
  const submit = async () => {
    if (
      submitting.current ||
      locked ||
      !projectPath ||
      (!input.trim() && !files.length) ||
      imagePaste.pasting ||
      !selection.valid
    )
      return
    submitting.current = true
    const submittedInput = input
    const submittedFiles = files
    setInput('')
    setFiles([])
    const ok = await send({
      projectPath,
      prompt: input.trim() || 'Describe the attached image.',
      model: selection.selectedModel,
      effort: selection.selectedEffort,
      access,
      windowsSandbox: compatibility ? 'unelevated' : undefined,
      sessionId: session?.id,
      attachments: files,
    })
    submitting.current = false
    if (ok) setError('')
    else {
      setInput((current) => [submittedInput, current].filter(Boolean).join('\n'))
      setFiles((current) => [...new Set([...submittedFiles, ...current])])
    }
  }

  return (
    <div
      className="space-y-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const paths = Array.from(e.dataTransfer.files)
          .map((file) => (file as File & { path?: string }).path)
          .filter((p): p is string => !!p)
        setFiles((prev) => [...new Set([...prev, ...paths])])
      }}
    >
      <details className="text-[10px] text-white/40">
        <summary className="cursor-pointer mb-2">Session settings</summary>
        <button onClick={selection.refresh} className="mb-2 text-accent-blue">
          Refresh model settings
        </button>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Codex project"
            value={projectPath}
            disabled={!!session || locked}
            onChange={(e) => setProjectPath(e.target.value)}
            className={`${fieldClass} flex-1`}
          >
            <option value="">Select a project folder</option>
            {projectPath && !projects.some((p) => p.path === projectPath) && (
              <option value={projectPath}>{projectPath}</option>
            )}
            {projects.map((p) => (
              <option key={p.path} value={p.path}>
                {p.name}
              </option>
            ))}
          </select>
          {!session && (
            <button aria-label="Browse project folder" onClick={browse} disabled={locked} className={fieldClass}>
              <FolderOpen size={14} />
            </button>
          )}
          <select
            aria-label="Codex access"
            value={access}
            onChange={(e) => setAccess(e.target.value as CodexAccess)}
            disabled={locked}
            className={fieldClass}
          >
            <option value="read-only">Read only</option>
            <option value="workspace-write">Edit project</option>
            <option value="danger-full-access">Full access</option>
          </select>
        </div>
        <p className="text-[10px] text-white/40">
          {access === 'danger-full-access'
            ? 'Full access allows commands and file changes outside the project.'
            : access === 'read-only'
              ? 'Inspect files and answer questions without making changes.'
              : 'Codex can edit files and run commands within this project.'}{' '}
          Uses your Codex login, instructions, and configured tools.
        </p>
        {navigator.userAgent.includes('Windows') && (
          <label className="flex items-center gap-2 text-[10px] text-white/40">
            <input
              type="checkbox"
              checked={compatibility}
              disabled={locked}
              onChange={(e) => {
                setCompatibility(e.target.checked)
                localStorage.setItem('codex-windows-compatibility', String(e.target.checked))
              }}
            />
            Windows compatibility sandbox (use if standard sandbox setup fails)
          </label>
        )}
      </details>
      <div className="flex gap-2">
        <CodexModelSelect
          selection={selection}
          model={model}
          onChange={(value) => {
            setModel(value)
            setEffort(effortForModel(selection, value, effort))
          }}
          disabled={locked}
          className={`${fieldClass} flex-1`}
        />
        <CodexEffortSelect
          selection={selection}
          effort={effort}
          onChange={setEffort}
          disabled={locked}
          className={fieldClass}
        />
      </div>
      {!!session?.pendingTurns?.length && (
        <div
          className="rounded-lg border border-accent-blue/15 bg-accent-blue/5 px-3 py-2 space-y-2"
          aria-label="Queued messages"
        >
          <div className="flex items-center justify-between text-[10px] text-accent-blue">
            <span>
              {session.pendingTurns.length} queued{' '}
              {session.queuePaused ? session.pauseReason === 'error' ? '- needs attention' : '- paused' : '- continues automatically'}
            </span>
            <button onClick={toggleQueue} aria-expanded={!queueCollapsed} className="underline">{queueCollapsed ? 'Show queued messages' : 'Hide queued messages'}</button>
            {session.queuePaused && (
              <button
                onClick={async () => {
                  try {
                    useCodexStore.getState().update(await window.electronAPI.codexQueue(session.id, 'resume'))
                  } catch (err) {
                    setError(String(err))
                  }
                }}
                className="underline"
              >
                Resume work & queue
              </button>
            )}
          </div>
          {!queueCollapsed && session.pendingTurns.map((pending, index) => (
            <div key={pending.id} className="flex items-start justify-between gap-2 text-[11px] text-white/60">
              <div className="min-w-0"><span className="text-[9px] text-accent-blue">{index === 0 ? 'Next' : `Waiting ${index + 1}`} · Queued — not sent yet</span><p className="whitespace-pre-wrap break-words">{pending.options.prompt}</p></div>
              <button
                aria-label={`Remove queued message: ${pending.options.prompt}`}
                onClick={async () => {
                  try {
                    useCodexStore
                      .getState()
                      .update(await window.electronAPI.codexQueue(session.id, 'remove', pending.id))
                  } catch (err) {
                    setError(String(err))
                  }
                }}
                className="shrink-0 text-white/30 hover:text-accent-red"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {selection.error && (
        <p role="alert" className="text-xs text-accent-red">
          {selection.error}{' '}
          <button onClick={selection.refresh} className="underline">
            Retry
          </button>
        </p>
      )}
      {imagePaste.pasting && (
        <p role="status" className="text-[10px] text-white/40">
          Attaching image...
        </p>
      )}
      {files.length > 0 && (
        <CodexAttachments
          files={files}
          onRemove={(file) => setFiles((current) => current.filter((item) => item !== file))}
        />
      )}
      {error && (
        <p role="alert" className="text-xs text-accent-red">
          {error}
        </p>
      )}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] text-white/25">Replying to</span>
        <span className="text-[9px] text-white/50 font-accent">{projectPath.split(/[/\\]/).pop()}</span>
      </div>
      <div className="flex items-end gap-2">
        <button
          title="Attach files or images"
          aria-label="Attach files or images"
          onClick={attach}
          className={`${fieldClass} p-2`}
        >
          <Paperclip size={14} />
        </button>
        <textarea
          aria-label="Message Codex"
          onPaste={imagePaste.onPaste}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={1}
          placeholder={working ? 'Type or paste a follow-up while Codex works...' : 'Type or paste a message...'}
          className={`${fieldClass} flex-1 bg-surface-0 resize-none min-h-[36px] max-h-[120px]`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void submit()
            }
          }}
        />
        {working && session && (
          <button
            onClick={() => stop(session.id)}
            className="px-3 py-2 rounded-lg bg-accent-red/15 text-accent-red text-xs flex items-center gap-1"
          >
            <Square size={12} /> Stop
          </button>
        )}
        <Button
          aria-label="Send to Codex"
          title={working ? 'Queue message after the current turn' : 'Send to Codex'}
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={
            locked || !projectPath || (!input.trim() && !files.length) || imagePaste.pasting || !selection.valid
          }
        >
          <Send size={12} />
        </Button>
      </div>
      <p className="text-[9px] text-white/30">
        You can type while Codex works. Sent follow-ups run in order. Enter to send · Shift+Enter for a new line · Drop
        files to attach, or paste an image
      </p>
    </div>
  )
}
