import { CodexModelSelect, CodexEffortSelect } from './CodexModelControls'
import { useCodexModelSelection, effortForModel } from '../../hooks/useCodexModelSelection'
import { Button } from '../ui'
import { useState } from 'react'
import { FolderOpen, Paperclip, Send, Square, X } from 'lucide-react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { useCodexStore } from '../../store/codexStore'
import type { CodexAccess, CodexSession } from '../../types/codex'

const fieldClass =
  'bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 min-w-0 focus:outline-none focus:border-accent-blue/40'

export default function CodexComposer({ session }: { session?: CodexSession }) {
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
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [error, setError] = useState('')
  const working = session?.status === 'working'
  const locked = working || sending

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
    if (locked || !projectPath || !input.trim() || !selection.valid) return
    const ok = await send({
      projectPath,
      prompt: input.trim(),
      model: selection.selectedModel,
      effort: selection.selectedEffort,
      access,
      windowsSandbox: compatibility ? 'unelevated' : undefined,
      sessionId: session?.id,
      attachments: files,
    })
    if (ok) {
      setInput('')
      setFiles([])
      setError('')
    }
  }

  return (
    <div
      className="space-y-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (locked) return
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
      {selection.error && (
        <p role="alert" className="text-xs text-accent-red">
          {selection.error}{' '}
          <button onClick={selection.refresh} className="underline">
            Retry
          </button>
        </p>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {files.map((file) => (
            <span
              key={file}
              title={file}
              className="flex items-center gap-1 px-2 py-1 bg-surface-3 rounded text-[10px] text-white/60"
            >
              {file.split(/[/\\]/).pop()}
              <button
                aria-label={`Remove ${file}`}
                disabled={locked}
                onClick={() => setFiles((prev) => prev.filter((p) => p !== file))}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
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
          disabled={locked}
          className={`${fieldClass} p-2`}
        >
          <Paperclip size={14} />
        </button>
        <textarea
          aria-label="Message Codex"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={1}
          disabled={locked}
          placeholder={
            working
              ? 'Codex is working… Stop to interrupt.'
              : session
                ? 'Continue this session…'
                : 'Describe what you want Codex to build or fix…'
          }
          className={`${fieldClass} flex-1 bg-surface-0 resize-none min-h-[36px] max-h-[120px]`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void submit()
            }
          }}
        />
        {working && session ? (
          <button
            onClick={() => stop(session.id)}
            className="px-3 py-2 rounded-lg bg-accent-red/15 text-accent-red text-xs flex items-center gap-1"
          >
            <Square size={12} /> Stop
          </button>
        ) : (
          <Button
            aria-label="Send to Codex"
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={locked || !projectPath || !input.trim() || !selection.valid}
          >
            <Send size={12} />
          </Button>
        )}
      </div>
      <p className="text-[9px] text-white/30">
        Model and effort apply to your next reply. Enter to send · Shift+Enter for a new line · Drop files to attach
      </p>
    </div>
  )
}
