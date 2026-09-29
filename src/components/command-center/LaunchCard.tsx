import { useCodexImagePaste } from '../../hooks/useCodexImagePaste'
import CodexAttachments from './CodexAttachments'
import { useState, useEffect, useCallback } from 'react'
import { CodexModelSelect, CodexEffortSelect } from './CodexModelControls'
import { useCodexModelSelection, effortForModel } from '../../hooks/useCodexModelSelection'
import { useCodexStore } from '../../store/codexStore'
import type { CodexAccess } from '../../types/codex'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { Button, Dialog } from '../ui'
import { Rocket, FolderPlus, FolderOpen, X } from 'lucide-react'
import {
  CLAUDE_MODELS,
  CHAT_MODEL,
  DEFAULT_MODEL,
  DEFAULT_EFFORT,
  EFFORT_LEVELS,
  resolveModelId,
} from '../../lib/models'

export default function LaunchCard({ provider = 'claude' }: { provider?: 'claude' | 'codex' }) {
  const codex = useCodexStore()
  const isCodex = provider === 'codex'
  const [access, setAccess] = useState<CodexAccess>('workspace-write')
  const [compatibility, setCompatibility] = useState(localStorage.getItem('codex-windows-compatibility') === 'true')
  const [error, setError] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const imagePaste = useCodexImagePaste(
    (files) => setAttachments((current) => [...new Set([...current, ...files])]),
    setError
  )
  const [launching, setLaunching] = useState(false)
  const { projects, launch, setLaunchOpen, loadProjects, launchPrefilledProject, setLaunchPrefilledProject } =
    useCommandCenterStore()
  const [projectPath, setProjectPath] = useState((isCodex ? codex.launchProject : launchPrefilledProject) || '')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<string>(isCodex ? '' : DEFAULT_MODEL)
  const [effort, setEffort] = useState<string>(isCodex ? '' : DEFAULT_EFFORT)
  const selection = useCodexModelSelection(projectPath, model, effort, isCodex)
  const [autoInfer, setAutoInfer] = useState(true)
  const [maxBudget, setMaxBudget] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Load CC defaults
  useEffect(() => {
    if (isCodex) return
    window.electronAPI
      .ccGetSettings()
      .then((s) => {
        setModel(resolveModelId(s.defaultModel))
        setEffort(s.defaultEffort)
        setAutoInfer(s.autoInferModel)
      })
      .catch((err) => setError(String(err)))
  }, [isCodex])

  useEffect(() => {
    return () => {
      if (!isCodex) setLaunchPrefilledProject(null)
    }
  }, [setLaunchPrefilledProject, isCodex])

  const handleBrowse = async () => {
    const result = await window.electronAPI.ccBrowseProject()
    if (result) {
      setProjectPath(result.path)
      loadProjects()
    }
  }

  const handleCreateProject = async () => {
    if (!newName.trim()) return
    const result = await window.electronAPI.ccCreateProject({ name: newName.trim() })
    if (result) {
      setProjectPath(result.path)
      loadProjects()
      setCreatingNew(false)
      setNewName('')
    }
  }

  const inferModel = useCallback((text: string) => {
    const lower = text.toLowerCase()
    const codingSignals =
      /\b(implement|build|fix|refactor|write code|add feature|bug|test|migrate|endpoint|component|function|class|module|api)\b/
    if (codingSignals.test(lower)) return DEFAULT_MODEL
    return CHAT_MODEL
  }, [])

  const handleClose = () => {
    if (isCodex) {
      useCodexStore.setState({ launchOpen: false })
      return
    }
    setLaunchPrefilledProject(null)
    setLaunchOpen(false)
  }

  const handleLaunch = async () => {
    if (
      !projectPath ||
      (!prompt.trim() && !(isCodex && attachments.length)) ||
      imagePaste.pasting ||
      launching ||
      (isCodex && !selection.valid)
    )
      return
    if (isCodex) {
      await codex.send({
        projectPath,
        prompt: prompt.trim() || 'Describe the attached image.',
        attachments,
        model: selection.selectedModel,
        effort: selection.selectedEffort,
        access,
        windowsSandbox: compatibility ? 'unelevated' : undefined,
      })
      return
    }
    setLaunching(true)
    try {
      await launch(projectPath, prompt.trim(), {
        model,
        effort,
        maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
      })
    } catch (err) {
      setError(String(err))
    } finally {
      setLaunching(false)
    }
  }

  const canLaunch =
    projectPath &&
    (prompt.trim() || (isCodex && attachments.length)) &&
    !imagePaste.pasting &&
    !launching &&
    !codex.sending &&
    (!isCodex || selection.valid)

  const inputClass =
    'w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 placeholder-white/20 focus:outline-none focus:border-accent-blue/40'

  return (
    <Dialog open onClose={handleClose}>
      <div className="bg-surface-1 border border-white/[0.08] rounded-xl w-[440px] max-w-[90vw] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white/90">New Task</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Project */}
        <div className="mb-4">
          <label className="text-[11px] text-white/50 font-medium mb-1.5 block">Project</label>
          {creatingNew ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject()
                  if (e.key === 'Escape') setCreatingNew(false)
                }}
                placeholder="my-new-project"
                className={`min-w-0 flex-1 ${inputClass}`}
              />
              <Button variant="primary" size="sm" onClick={handleCreateProject} disabled={!newName.trim()}>
                Create
              </Button>
              <button
                onClick={() => {
                  setCreatingNew(false)
                  setNewName('')
                }}
                className="shrink-0 p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <select
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                className={`mb-2 ${inputClass}`}
              >
                <option value="">Select project...</option>
                {projectPath && !projects.some((p) => p.path === projectPath) && (
                  <option value={projectPath}>{projectPath.split(/[/\\]/).pop()}</option>
                )}
                {projects.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCreatingNew(true)}
                  className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors"
                >
                  <FolderPlus size={12} /> New project
                </button>
                <button
                  onClick={handleBrowse}
                  className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors"
                >
                  <FolderOpen size={12} /> Browse
                </button>
              </div>
            </>
          )}
        </div>

        {/* Prompt */}
        <div className="mb-4">
          <label className="text-[11px] text-white/50 font-medium mb-1.5 block">Prompt</label>
          <textarea
            onPaste={isCodex ? imagePaste.onPaste : undefined}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              if (!isCodex && autoInfer) setModel(inferModel(e.target.value))
            }}
            placeholder={isCodex ? 'What should Codex do?' : 'What should Claude do?'}
            className={`resize-none min-h-[100px] ${inputClass}`}
            rows={4}
          />
        </div>

        {isCodex && imagePaste.pasting && (
          <p role="status" className="text-[10px] text-white/40 mb-2">
            Attaching image...
          </p>
        )}
        {isCodex && attachments.length > 0 && (
          <div className="mb-4">
            <CodexAttachments
              files={attachments}
              onRemove={(file) => setAttachments((current) => current.filter((item) => item !== file))}
            />
          </div>
        )}
        {/* Model + Effort + Budget row */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 min-w-0">
            <label className="text-[11px] text-white/50 font-medium mb-1.5 block">Model</label>
            {isCodex ? (
              <CodexModelSelect
                selection={selection}
                model={model}
                onChange={(value) => {
                  setModel(value)
                  setEffort(effortForModel(selection, value, effort))
                }}
                className={inputClass}
              />
            ) : (
              <select value={model} onChange={(e) => setModel(e.target.value)} className={inputClass}>
                {CLAUDE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[11px] text-white/50 font-medium mb-1.5 block">Effort</label>
            {isCodex ? (
              <CodexEffortSelect selection={selection} effort={effort} onChange={setEffort} className={inputClass} />
            ) : (
              <select value={effort} onChange={(e) => setEffort(e.target.value)} className={inputClass}>
                {EFFORT_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[11px] text-white/50 font-medium mb-1.5 block">
              {isCodex ? 'Access' : 'Budget (USD)'}
            </label>
            {isCodex ? (
              <select
                aria-label="Codex access"
                value={access}
                onChange={(e) => setAccess(e.target.value as CodexAccess)}
                className={inputClass}
              >
                <option value="read-only">Read only</option>
                <option value="workspace-write">Edit project</option>
                <option value="danger-full-access">Full access</option>
              </select>
            ) : (
              <input
                type="number"
                step="0.50"
                min="0"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder="No limit"
                className={inputClass}
              />
            )}
          </div>
        </div>

        {isCodex && (
          <details className="mb-4 text-[10px] text-white/40">
            <summary className="cursor-pointer">Advanced settings</summary>
            <button onClick={selection.refresh} className="mt-2 text-accent-blue">
              Refresh model settings
            </button>
            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={compatibility}
                onChange={(e) => {
                  setCompatibility(e.target.checked)
                  localStorage.setItem('codex-windows-compatibility', String(e.target.checked))
                }}
              />{' '}
              Windows compatibility sandbox
            </label>
          </details>
        )}
        {(error || (isCodex && codex.error)) && (
          <p role="alert" className="text-xs text-accent-red mb-3">
            {error || codex.error}
          </p>
        )}
        {isCodex && selection.error && (
          <p role="alert" className="text-xs text-accent-red mb-3">
            {selection.error}{' '}
            <button onClick={selection.refresh} className="underline">
              Retry
            </button>
          </p>
        )}
        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleLaunch} disabled={!canLaunch}>
            <Rocket size={12} /> Launch
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
