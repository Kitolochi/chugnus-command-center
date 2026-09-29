// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
const mocks = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('child_process', () => ({ spawn: mocks.spawn }))
vi.mock('./codex-cli', () => ({ resolveCodexBinary: () => 'codex.exe' }))
import { getCodexModelSettings, resolveCodexSelection } from './codex-models'

const definition = (model: string, efforts: string[], isDefault = false) => ({
  model,
  displayName: model,
  description: '',
  defaultReasoningEffort: 'low',
  supportedReasoningEfforts: efforts.map((reasoningEffort) => ({ reasoningEffort, description: '' })),
  isDefault,
})
function server(failure = false) {
  const proc = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdin: new PassThrough(),
    kill: vi.fn(),
  })
  proc.stdin.on('data', (chunk) => {
    for (const line of chunk.toString().trim().split('\n')) {
      const request = JSON.parse(line)
      if (!request.id) continue
      let result: unknown = {}
      if (request.method === 'config/read')
        result = { config: { model: 'model-a', model_reasoning_effort: 'high', privateKey: 'never-return-this' } }
      if (request.method === 'model/list')
        result = request.params.cursor
          ? { data: [definition('model-b', ['low', 'high'])], nextCursor: null }
          : { data: [definition('model-a', ['low', 'high', 'max', 'ultra'], true)], nextCursor: 'next-page' }
      queueMicrotask(() =>
        proc.stdout.write(
          JSON.stringify(failure ? { id: request.id, error: { message: 'Unavailable' } } : { id: request.id, result }) +
            '\n'
        )
      )
    }
  })
  mocks.spawn.mockReturnValue(proc)
  return proc
}

describe('live Codex model configuration', () => {
  it('reads project defaults and every catalog page without exposing other config', async () => {
    const proc = server()
    const settings = await getCodexModelSettings('C:\\project')
    expect(mocks.spawn).toHaveBeenCalledWith(
      'codex.exe',
      ['app-server'],
      expect.objectContaining({ cwd: 'C:\\project', windowsHide: true })
    )
    expect(settings.defaultModel).toBe('model-a')
    expect(settings.defaultEffort).toBe('high')
    expect(settings.models).toHaveLength(2)
    expect(settings.models[0].efforts.map((e) => e.value)).toContain('ultra')
    expect(JSON.stringify(settings)).not.toContain('never-return-this')
    expect(proc.kill).toHaveBeenCalled()
  })
  it('uses actual defaults, accepts catalog efforts, and rejects invalid combinations', async () => {
    server()
    const settings = await getCodexModelSettings()
    expect(resolveCodexSelection(settings)).toEqual({ model: 'model-a', effort: 'high' })
    expect(resolveCodexSelection(settings, 'model-a', 'ultra')).toEqual({ model: 'model-a', effort: 'ultra' })
    expect(resolveCodexSelection(settings, 'model-b')).toEqual({ model: 'model-b', effort: 'low' })
    expect(() => resolveCodexSelection(settings, 'model-b', 'ultra')).toThrow('does not support')
    expect(() => resolveCodexSelection(settings, 'missing')).toThrow('no longer available')
  })
  it('reports server errors and closes its helper process', async () => {
    const proc = server(true)
    await expect(getCodexModelSettings()).rejects.toThrow('Unavailable')
    expect(proc.kill).toHaveBeenCalled()
  })
})
