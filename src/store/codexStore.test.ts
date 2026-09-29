import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCodexStore } from './codexStore'
import { useCommandCenterStore } from './commandCenterStore'
import { codexQueueItem } from '../lib/codexQueue'
import type { CodexSession } from '../types/codex'

const task = (status: CodexSession['status'] = 'ready'): CodexSession => ({
  id: 'codex-task',
  threadId: 'saved-thread',
  projectPath: 'C:\\projects\\demo',
  title: 'Fix demo',
  access: 'workspace-write',
  status,
  archived: false,
  messages: [{ id: 'reply', role: 'assistant', content: 'Done' }],
  activity: [],
  filesChanged: ['demo.ts'],
  tokensIn: 200,
  tokensOut: 40,
  turns: 1,
  createdAt: 1,
  updatedAt: 2,
})

beforeEach(() => {
  useCodexStore.setState({
    sessions: [task()],
    selectedId: null,
    selectedProject: null,
    history: false,
    launchOpen: false,
    error: null,
    sending: false,
  })
  useCommandCenterStore.setState({ queue: [], selectedProject: null, focusId: null, activeView: 'queue' })
})

describe('Codex in the shared task queue', () => {
  it('maps live Codex statuses and replies to the shared task card', () => {
    expect(codexQueueItem(task())).toMatchObject({
      provider: 'codex',
      processId: 'codex-task',
      status: 'awaiting_input',
      resultText: 'Done',
    })
    expect(codexQueueItem(task('working')).status).toBe('working')
    expect(codexQueueItem(task('error')).status).toBe('errored')
    expect(codexQueueItem(task('stopped')).status).toBe('awaiting_input')
  })
  it('selects the saved session in the shared project queue', () => {
    useCodexStore.getState().select('codex-task')
    expect(useCommandCenterStore.getState()).toMatchObject({
      selectedProject: task().projectPath,
      focusId: 'codex-task',
      activeView: 'codex',
    })
  })
  it('launches the dialog without clearing the current task', () => {
    useCodexStore.getState().select('codex-task')
    useCodexStore.getState().newTask()
    expect(useCodexStore.getState()).toMatchObject({
      selectedId: 'codex-task',
      launchOpen: true,
      launchProject: task().projectPath,
    })
  })
  it('routes replies to Codex and retains the draft on launch failure', async () => {
    const codexTurn = vi.fn().mockRejectedValue(new Error('Unavailable'))
    vi.stubGlobal('electronAPI', undefined)
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: { codexTurn } })
    useCodexStore.getState().newTask()
    const options = { projectPath: task().projectPath, sessionId: task().id, prompt: 'Continue', access: task().access }
    expect(await useCodexStore.getState().send(options)).toBe(false)
    expect(codexTurn).toHaveBeenCalledWith(options)
    expect(useCodexStore.getState()).toMatchObject({ launchOpen: true, sending: false, error: 'Error: Unavailable' })
  })
  it('waits for a running task to stop before parking, and persists its disposition', async () => {
    useCodexStore.setState({ sessions: [task('working')] })
    const order: string[] = []
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        codexStop: vi.fn(async () => {
          order.push('stop')
        }),
        codexSessions: vi.fn(async () => {
          order.push('read')
          return [task('stopped')]
        }),
        codexArchive: vi.fn(async (_id, _archived, disposition) => {
          order.push(disposition)
        }),
      },
    })
    await useCodexStore.getState().archive('codex-task', true, 'completed')
    expect(order).toEqual(['stop', 'read', 'completed', 'read'])
    expect(useCodexStore.getState().error).toBeNull()
  })
})
