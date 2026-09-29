import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import CodexConversation from './CodexConversation'
import type { CodexSession } from '../../types/codex'

afterEach(cleanup)
const session: CodexSession = { id: 's', projectPath: 'C:/demo', title: 'Build', status: 'working', archived: false, access: 'read-only', filesChanged: [], tokensIn: 0, tokensOut: 0, turns: 1, createdAt: 0, updatedAt: 0, messages: [{ id: 'old', role: 'user', content: 'An older request' }, { id: 'done', role: 'user', content: 'First task', state: 'completed' }, { id: 'active', role: 'user', content: 'Render the new camera move', state: 'working', queuedId: 'queued-1' }], activity: [{ id: 'cmd', kind: 'command_execution', text: 'blender -b scene.blend\nRendering frame 12', status: 'in_progress', updatedAt: Date.now() }], pendingTurns: [{ id: 'q', options: { projectPath: 'C:/demo', prompt: 'Add blur', access: 'read-only' } }], lastEventAt: Date.now() }

describe('visible message and work progress', () => {
  it('distinguishes unknown old status, finished turns, active queued messages and live tool output', () => {
    render(<CodexConversation session={session} />)
    expect(screen.getByText('Sent · status not recorded')).toBeTruthy()
    expect(screen.getByText('Turn finished')).toBeTruthy()
    expect(screen.getByText('Working on this')).toBeTruthy()
    expect(screen.getByText('Working on message 3')).toBeTruthy()
    expect(screen.getByText('You · 3 · from queue')).toBeTruthy()
    expect(screen.getByText('1 waiting')).toBeTruthy()
    expect(screen.getByText(/Rendering frame 12/)).toBeTruthy()
  })
  it('changes to paused and does not display stale tools as still running', () => {
    render(<CodexConversation session={{ ...session, status: 'stopped', queuePaused: true, messages: session.messages.map(m => m.id === 'active' ? { ...m, state: 'interrupted' } : m) }} />)
    expect(screen.getByText('Paused — no work running')).toBeTruthy()
    expect(screen.getByText('Interrupted')).toBeTruthy()
    expect(screen.queryByText('running')).toBeNull()
    expect(screen.getByText('1 waiting · queue paused')).toBeTruthy()
  })
})
