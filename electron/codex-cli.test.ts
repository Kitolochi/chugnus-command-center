// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { applyCodexEvent, buildCodexArgs } from './codex-cli'
import type { CodexSession } from '../src/types/codex'

const session = (): CodexSession => ({ id: 'session', projectPath: 'C:/project', title: 'Test', access: 'workspace-write', status: 'working', archived: false, messages: [], activity: [], filesChanged: [], tokensIn: 0, tokensOut: 0, turns: 0, createdAt: 0, updatedAt: 0 })

describe('Codex CLI protocol', () => {
  it('uses stdin and passes resume sandbox options to the parent command', () => {
    const args = buildCodexArgs({ projectPath: 'C:/project', prompt: '$(not a shell) & "quoted"', access: 'workspace-write', attachments: ['C:/my image.png', 'C:/code.ts'] }, 'thread-123')
    expect(args).toEqual(['exec', '--json', '--skip-git-repo-check', '-c', 'approval_policy="never"', '--sandbox', 'workspace-write', 'resume', 'thread-123', '--image', 'C:/my image.png', '-'])
    expect(args.join(' ')).not.toContain('not a shell')
  })
  it('keeps configured model defaults unless explicitly selected', () => {
    const args = buildCodexArgs({ projectPath: '/project', prompt: 'test', access: 'read-only' })
    expect(args).not.toContain('--model')
    expect(args).toContain('read-only')
  })
  it('tracks the thread and upserts streamed items without duplicate messages', () => {
    const s = session()
    applyCodexEvent(s, { type: 'thread.started', thread_id: 'abc' }, 'turn1')
    applyCodexEvent(s, { type: 'item.updated', item: { id: '0', type: 'agent_message', text: 'Hello' } }, 'turn1')
    applyCodexEvent(s, { type: 'item.completed', item: { id: '0', type: 'agent_message', text: 'Hello world' } }, 'turn1')
    applyCodexEvent(s, { type: 'item.completed', item: { id: '0', type: 'agent_message', text: 'Follow-up' } }, 'turn2')
    expect(s.threadId).toBe('abc')
    expect(s.messages.map(m => m.content)).toEqual(['Hello world', 'Follow-up'])
  })
  it('updates command output, file changes, and token usage', () => {
    const s = session()
    for (const status of ['in_progress', 'completed']) applyCodexEvent(s, { type: 'item.completed', item: { id: 'cmd', type: 'command_execution', command: 'npm test', aggregated_output: 'passed', status } }, 'turn1')
    applyCodexEvent(s, { type: 'item.completed', item: { id: 'edit', type: 'file_change', changes: [{ path: 'app.ts', kind: 'update' }] } }, 'turn1')
    applyCodexEvent(s, { type: 'turn.completed', usage: { input_tokens: 30, output_tokens: 10 } }, 'turn1')
    expect(s.activity).toHaveLength(2)
    expect(s.activity[0].text).toContain('passed')
    expect(s.activity[0].status).toBe('completed')
    expect(s.filesChanged).toEqual(['app.ts'])
    expect([s.tokensIn, s.tokensOut, s.turns]).toEqual([30, 10, 1])
  })
  it('surfaces terminal failures but allows transient reconnect errors', () => {
    const s = session()
    applyCodexEvent(s, { type: 'error', message: 'Reconnecting' }, 'turn1')
    expect(s.status).toBe('working')
    applyCodexEvent(s, { type: 'turn.failed', error: { message: 'Rate limited' } }, 'turn1')
    expect(s.status).toBe('error')
    expect(s.error).toBe('Rate limited')
  })
  it('does not claim a failed edit changed a file', () => {
    const s = session()
    applyCodexEvent(s, { type: 'item.completed', item: { id: 'edit', type: 'file_change', status: 'failed', changes: [{ path: 'app.ts' }] } }, 'turn1')
    expect(s.filesChanged).toEqual([])
    expect(s.activity[0].status).toBe('failed')
    expect(s.resources?.find(r => r.value === 'app.ts')?.evidence).toBe('tool')
  })
  it('keeps resources from earlier turns after the activity list is reset', () => {
    const s = session()
    applyCodexEvent(s, { type: 'item.completed', item: { id: 'read', type: 'command_execution', command: 'Get-Content "C:\\My Project\\app.ts"' } }, 'turn1')
    s.activity = []
    applyCodexEvent(s, { type: 'item.completed', item: { id: 'web', type: 'mcp_tool_call', arguments: { url: 'https://example.com/editor' } } }, 'turn2')
    expect(s.resources?.map(r => r.value)).toEqual(expect.arrayContaining(['C:/My Project/app.ts', 'https://example.com/editor']))
  })
})
