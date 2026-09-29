import { spawn } from 'child_process'
import readline from 'readline'
import { resolveCodexBinary } from './codex-cli'
import type { CodexModelSettings, CodexModel } from '../src/types/codex'

// Ask the installed CLI: this respects the account, project config, and current catalog.
// Only return model controls to the renderer, never the rest of the user's config.
export async function getCodexModelSettings(projectPath?: string): Promise<CodexModelSettings> {
  const proc = spawn(resolveCodexBinary(), ['app-server'], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...(projectPath ? { cwd: projectPath } : {}),
  })
  const lines = readline.createInterface({ input: proc.stdout })
  let sequence = 0
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>()
  let failed: Error | null = null
  const fail = (error: Error) => {
    failed = error
    for (const request of pending.values()) request.reject(error)
    pending.clear()
  }
  const request = (method: string, params: unknown): Promise<any> =>
    new Promise((resolve, reject) => {
      if (failed) {
        reject(failed)
        return
      }
      const id = ++sequence
      pending.set(id, { resolve, reject })
      proc.stdin.write(JSON.stringify({ id, method, params }) + '\n')
    })
  proc.on('error', fail)
  proc.stdin.on('error', fail)
  proc.on('exit', () => fail(new Error('Codex closed before returning model settings')))
  proc.stderr.resume()
  lines.on('line', (line) => {
    try {
      const message = JSON.parse(line)
      const handler = pending.get(message.id)
      if (!handler) return
      pending.delete(message.id)
      if (message.error) handler.reject(new Error(message.error.message || 'Codex settings request failed'))
      else handler.resolve(message.result)
    } catch {
      /* Ignore non-protocol diagnostics. */
    }
  })
  const timeout = setTimeout(() => {
    fail(new Error('Timed out reading Codex model settings'))
    proc.kill()
  }, 20000)
  try {
    await request('initialize', {
      clientInfo: { name: 'chugnus_command_center', title: 'Chugnus Command Center', version: '1.0.0' },
    })
    proc.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n')
    const [configResult, firstPage] = await Promise.all([
      request('config/read', { includeLayers: false, ...(projectPath ? { cwd: projectPath } : {}) }),
      request('model/list', { limit: 100, includeHidden: false }),
    ])
    const catalog = [...firstPage.data]
    let cursor = firstPage.nextCursor
    while (cursor) {
      const page = await request('model/list', { limit: 100, includeHidden: false, cursor })
      catalog.push(...page.data)
      cursor = page.nextCursor
    }
    const models: CodexModel[] = catalog
      .filter((model) => !model.hidden)
      .map((model) => ({
        model: model.model,
        displayName: model.displayName,
        description: model.description,
        defaultEffort: model.defaultReasoningEffort,
        efforts: model.supportedReasoningEfforts.map((effort: { reasoningEffort: string; description: string }) => ({
          value: effort.reasoningEffort,
          description: effort.description,
        })),
      }))
    const defaultModel =
      configResult.config.model || catalog.find((model) => model.isDefault)?.model || models[0]?.model
    const defaultEffort =
      configResult.config.model_reasoning_effort || models.find((model) => model.model === defaultModel)?.defaultEffort
    if (!defaultModel) throw new Error('Codex returned no available models')
    if (!models.some((model) => model.model === defaultModel)) {
      models.unshift({
        model: defaultModel,
        displayName: defaultModel,
        description: 'Configured model',
        defaultEffort,
        efforts: defaultEffort ? [{ value: defaultEffort, description: 'Configured reasoning effort' }] : [],
      })
    }
    return { models, defaultModel, defaultEffort }
  } finally {
    clearTimeout(timeout)
    lines.close()
    proc.stdin.end()
    proc.kill()
  }
}

export function resolveCodexSelection(settings: CodexModelSettings, model?: string, effort?: string) {
  const selected = settings.models.find((item) => item.model === (model || settings.defaultModel))
  if (!selected) throw new Error('This model is no longer available. Refresh model settings and choose another model.')
  const configuredEffort = selected.model === settings.defaultModel ? settings.defaultEffort : undefined
  const defaultEffort = selected.efforts.some((item) => item.value === configuredEffort)
    ? configuredEffort
    : selected.defaultEffort
  const selectedEffort = effort || defaultEffort
  if (selectedEffort && !selected.efforts.some((item) => item.value === selectedEffort)) {
    throw new Error(`${selected.displayName} does not support ${selectedEffort} effort. Choose a supported effort.`)
  }
  return { model: selected.model, effort: selectedEffort }
}
