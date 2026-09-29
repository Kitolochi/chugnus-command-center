// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import fs from 'fs'
import os from 'os'
import path from 'path'

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), execFile: vi.fn(), directory: '' }))
vi.mock('electron', () => ({ app: { getPath: () => mocks.directory } }))
vi.mock('child_process', () => ({ spawn: mocks.spawn, execFile: mocks.execFile }))
vi.mock('./codex-cli', async importOriginal => ({ ...await importOriginal<typeof import('./codex-cli')>(), resolveCodexBinary: () => 'codex.exe' }))

function child() {
  return Object.assign(new EventEmitter(), { pid: 12345, stdout: new PassThrough(), stderr: new PassThrough(), stdin: new PassThrough(), kill: vi.fn() })
}

beforeEach(() => {
  vi.resetModules()
  mocks.spawn.mockReset()
  mocks.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chugnus-codex-test-'))
})
afterEach(() => fs.rmSync(mocks.directory, { recursive: true, force: true }))

describe('Codex session lifecycle', () => {
  it('streams split UTF-8, persists history and resumes the exact thread', async () => {
    const api = await import('./codex-sessions')
    const proc = child()
    mocks.spawn.mockReturnValue(proc)
    api.initCodexSessions({ isDestroyed: () => false, webContents: { send: vi.fn() } } as any)
    const opts = { projectPath: mocks.directory, prompt: 'hello', access: 'workspace-write' as const, model: 'catalog-model', effort: 'ultra' }
    const s = api.startCodexTurn(opts)
    proc.stdout.write('{"type":"thread.started","thread_id":"thread-123"}\n')
    const chunk = Buffer.from('{"type":"item.completed","item":{"id":"0","type":"agent_message","text":"Ready 🐇"}}\n')
    const split = chunk.indexOf(Buffer.from('🐇')) + 2
    proc.stdout.write(chunk.subarray(0, split)); proc.stdout.write(chunk.subarray(split))
    proc.stdout.write('{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":2}}')
    proc.emit('close', 0)
    expect(s.status).toBe('ready')
    expect(s.messages[1].content).toBe('Ready 🐇')
    expect(JSON.parse(fs.readFileSync(path.join(mocks.directory, 'codex-sessions.json'), 'utf8'))[0].threadId).toBe('thread-123')
    mocks.spawn.mockReturnValue(child())
    api.startCodexTurn({ ...opts, sessionId: s.id, prompt: 'continue' })
    expect(mocks.spawn.mock.calls[1][1]).toEqual(expect.arrayContaining(['resume', 'thread-123']))
    expect(() => api.startCodexTurn({ ...opts, sessionId: s.id })).toThrow('already working')
  })
  it('reports an early CLI exit instead of waiting forever', async () => {
    const api = await import('./codex-sessions')
    const proc = child(); mocks.spawn.mockReturnValue(proc)
    api.initCodexSessions({ isDestroyed: () => true } as any)
    const s = api.startCodexTurn({ projectPath: mocks.directory, prompt: 'test', access: 'read-only' })
    proc.stderr.write('Please sign in'); proc.emit('close', 1)
    expect(s.status).toBe('error')
    expect(s.error).toContain('Please sign in')
  })
  it('preserves corrupt history instead of silently overwriting it', async () => {
    const api = await import('./codex-sessions')
    const history = path.join(mocks.directory, 'codex-sessions.json')
    fs.writeFileSync(history, '{broken')
    api.initCodexSessions({ isDestroyed: () => true } as any)
    expect(() => api.getCodexSessions()).toThrow('preserved')
    expect(() => api.startCodexTurn({ projectPath: mocks.directory, prompt: 'test', access: 'read-only' })).toThrow('preserved')
    expect(fs.readFileSync(history, 'utf8')).toBe('{broken')
  })
  it('stops the process tree and ignores late completion events', async () => {
    const api = await import('./codex-sessions')
    const proc = child(); mocks.spawn.mockReturnValue(proc)
    api.initCodexSessions({ isDestroyed: () => true } as any)
    const s = api.startCodexTurn({ projectPath: mocks.directory, prompt: 'test', access: 'workspace-write' })
    api.stopCodexSession(s.id)
    if (process.platform === 'win32') expect(mocks.execFile).toHaveBeenCalledWith('taskkill', ['/pid', '12345', '/T', '/F'], { windowsHide: true }, expect.any(Function))
    proc.stdout.write('{"type":"turn.completed"}\n')
    proc.emit('close', 1)
    expect(s.status).toBe('stopped')
    expect(s.turns).toBe(0)
    api.archiveCodexSession(s.id, true)
    expect(s.archived).toBe(true)
    api.archiveCodexSession(s.id, true, 'completed')
    expect(s.disposition).toBe('completed')
    api.archiveCodexSession(s.id, false)
    expect(s.disposition).toBeUndefined()
  })
})
