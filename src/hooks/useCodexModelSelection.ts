import { useEffect, useState } from 'react'
import type { CodexModelSettings } from '../types/codex'

export function useCodexModelSelection(projectPath: string, model: string, effort: string, enabled = true) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: CodexModelSettings; error?: string } | null>(null)
  const key = `${projectPath}:${revision}`
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    window.electronAPI
      .codexModelSettings(projectPath || undefined)
      .then((data) => {
        if (!disposed) setResult({ key, data })
      })
      .catch((error) => {
        if (!disposed) setResult({ key, error: String(error) })
      })
    return () => {
      disposed = true
    }
  }, [projectPath, key, enabled])
  const data = result?.key === key ? result.data : undefined
  const error = result?.key === key ? result.error : undefined
  const selectedModel = model || data?.defaultModel || ''
  const definition = data?.models.find((item) => item.model === selectedModel)
  const configuredEffort = selectedModel === data?.defaultModel ? data?.defaultEffort : undefined
  const defaultEffort = definition?.efforts.some((item) => item.value === configuredEffort)
    ? configuredEffort
    : definition?.defaultEffort
  const selectedEffort = effort || defaultEffort || ''
  const valid = !!definition && (!selectedEffort || definition.efforts.some((item) => item.value === selectedEffort))
  return {
    data,
    error,
    definition,
    selectedModel,
    selectedEffort,
    defaultEffort,
    valid,
    loading: enabled && !data && !error,
    refresh: () => setRevision((value) => value + 1),
  }
}

type ModelSelection = ReturnType<typeof useCodexModelSelection>

export function effortForModel(selection: ModelSelection, model: string, effort: string) {
  return selection.data?.models
    .find((item) => item.model === (model || selection.data?.defaultModel))
    ?.efforts.some((item) => item.value === effort)
    ? effort
    : ''
}
