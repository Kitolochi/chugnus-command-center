// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getLiveMessages, listLiveSessions, parseSessionTail } from './live-sessions'

const lines = (...records: object[]) => records.map((r) => JSON.stringify(r)).join('\n') + '\n'

describe('parseSessionTail', () => {
  it('keeps what a person sees and skips tool results, side chains and wrappers', () => {
    const text =
      '{"type":"assistant","message":{"content":[{"type":"text","text":"cut off mid line' +
      '\n' +
      lines(
        { type: 'ai-title', aiTitle: 'Old title' },
        { type: 'user', message: { content: 'send the cold dms' }, timestamp: 't1' },
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Starting now.' },
              { type: 'tool_use', name: 'Bash', input: { command: 'ls  -la\n /tmp', description: 'List files' } },
              { type: 'tool_use', name: 'TodoWrite', input: { todos: [] } },
            ],
          },
        },
        { type: 'user', message: { content: [{ type: 'tool_result', content: 'file list' }] } },
        { type: 'user', message: { content: '<command-name>/resume</command-name>' } },
        { type: 'user', isCompactSummary: true, message: { content: 'This session is being continued...' } },
        { type: 'user', isMeta: true, message: { content: 'meta text' } },
        { type: 'assistant', isSidechain: true, message: { content: [{ type: 'text', text: 'subagent talk' }] } },
        { type: 'ai-title', aiTitle: 'Cold DM run' },
        { type: 'last-prompt', lastPrompt: 'send the cold dms' }
      )
    expect(parseSessionTail(text)).toEqual({
      title: 'Cold DM run',
      lastPrompt: 'send the cold dms',
      doing: 'Updating its plan',
      messages: [
        { role: 'user', text: 'send the cold dms', timestamp: 't1' },
        { role: 'assistant', text: 'Starting now.', timestamp: undefined },
        { role: 'tool', text: 'Bash: List files', timestamp: undefined },
        { role: 'tool', text: 'TodoWrite', timestamp: undefined },
        { role: 'tool', text: 'Earlier messages were summarized', timestamp: undefined },
      ],
    })
  })

  it('prefers a custom title over the AI title', () => {
    const text = lines({ type: 'custom-title', customTitle: 'Mine' }, { type: 'ai-title', aiTitle: 'Generated' })
    expect(parseSessionTail(text).title).toBe('Mine')
  })
})

describe('listLiveSessions', () => {
  let claudeDir: string
  const cwd = 'C:\\Users\\chris\\my.project'

  beforeEach(() => {
    claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chugnus-live-test-'))
    fs.mkdirSync(path.join(claudeDir, 'sessions'))
    const projectDir = path.join(claudeDir, 'projects', 'C--Users-chris-my-project')
    fs.mkdirSync(projectDir, { recursive: true })
    const register = (pid: number, sessionId: string, extra: object = {}) =>
      fs.writeFileSync(
        path.join(claudeDir, 'sessions', `${pid}.json`),
        JSON.stringify({ pid, sessionId, cwd, name: `chris-${pid}`, status: 'busy', kind: 'interactive', ...extra })
      )
    register(process.pid, 'live-1', { statusUpdatedAt: 5 })
    register(99999999, 'dead-1')
    fs.writeFileSync(
      path.join(projectDir, 'live-1.jsonl'),
      lines(
        { type: 'user', message: { content: 'render the film' } },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Render started.\nIt takes 70 minutes.' }] } },
        { type: 'ai-title', aiTitle: 'Film render' }
      )
    )
  })
  afterEach(() => fs.rmSync(claudeDir, { recursive: true, force: true }))

  it('lists running sessions with their title and latest line, and drops dead processes', () => {
    const sessions = listLiveSessions({ claudeDir })
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      pid: process.pid,
      sessionId: 'live-1',
      name: `chris-${process.pid}`,
      title: 'Film render',
      projectName: 'my.project',
      status: 'busy',
      latestActivity: 'Render started.',
      doing: 'Render started.',
    })
    expect(sessions[0].updatedAt).toBeGreaterThan(5)
  })

  it('leaves out sessions the command center already runs', () => {
    expect(listLiveSessions({ claudeDir, exclude: new Set(['live-1']) })).toEqual([])
  })

  it('returns the recent messages of one session', () => {
    expect(getLiveMessages({ sessionId: 'live-1', cwd, claudeDir }).map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(getLiveMessages({ sessionId: 'missing', cwd, claudeDir })).toEqual([])
  })
})

describe('prepareReply', () => {
  it('turns a multi-line reply into one line and trims it', async () => {
    const { prepareReply } = await import('./live-reply')
    expect(prepareReply('  yes do it\n\n  and push  \r\n')).toBe('yes do it and push')
    expect(prepareReply('x'.repeat(9000))).toHaveLength(8000)
  })
})
