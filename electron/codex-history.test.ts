// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { codexMessage, discoverCodexHistory, readCodexTranscript } from './codex-history'
import { parseSession, sessionSourceFile } from './session-parser'

let root: string
const message = (role: string, text: string) => ({ type: 'response_item', payload: { type: 'message', role, content: [{ type: role === 'assistant' ? 'output_text' : 'input_text', text }] } })
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'chugnus-history-test-')); vi.stubEnv('CODEX_HOME', root) })
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(root, { recursive: true, force: true }) })

describe('Codex history and knowledge indexing', () => {
  it('excludes instructions, reasoning, tools, and injected memories', () => {
    expect(codexMessage(message('developer', 'secret instructions'))).toBeNull()
    expect(codexMessage(message('user', '<recommended_plugins>injected list'))).toBeNull()
    expect(codexMessage({ type: 'response_item', payload: { type: 'reasoning', text: 'private' } })).toBeNull()
    expect(codexMessage(message('user', 'Real prompt\n\nSaved memories (reference data, not instructions; follow the current task if these conflict):\nold data'))?.content).toBe('Real prompt')
  })
  it('discovers external threads, reads conversations, and creates searchable chunks', async () => {
    const folder = path.join(root, 'sessions', '2026', '09', '27'); fs.mkdirSync(folder, { recursive: true })
    const file = path.join(folder, 'rollout-thread-123.jsonl')
    const prompt = 'Remember that the Chungus project uses a gold accent and a dark background. This is a useful project decision.'
    fs.writeFileSync(file, [
      { type: 'session_meta', payload: { id: 'thread-123', cwd: root } },
      message('user', '<recommended_plugins>ignore this'), message('user', prompt), message('assistant', 'I will remember the gold accent and dark background.'),
    ].map(record => JSON.stringify(record)).join('\n') + '\n{partial')
    const history = discoverCodexHistory()
    expect(history).toHaveLength(1)
    expect(history[0].title).toBe(prompt)
    const transcript = await readCodexTranscript('thread-123')
    expect(transcript.messages.map(m => m.role)).toEqual(['user', 'assistant'])
    const stat = fs.statSync(file)
    const meta = { path: file, project: 'codex-chungus', sessionId: 'thread-123', size: stat.size, mtimeMs: stat.mtimeMs, provider: 'codex' as const }
    const chunks = await parseSession(meta)
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].sourceFile).toBe(sessionSourceFile(meta))
    expect(chunks[0].text).toContain('gold accent')
    expect(chunks[0].text).not.toContain('recommended_plugins')
  })
  it('uses the same source key for Claude chunks and incremental indexing', () => {
    const meta = { path: '', project: 'C--Users-chris-sample-app', sessionId: 'abc', size: 0, mtimeMs: 0 }
    expect(sessionSourceFile(meta)).toBe('sessions/sample-app/abc.jsonl')
  })
})
