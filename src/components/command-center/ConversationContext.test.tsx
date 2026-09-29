import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConversationContext from './ConversationContext'
import type { CCQueueItem } from '../../store/commandCenterStore'

afterEach(cleanup)
const item: CCQueueItem = { processId: '1', projectPath: 'C:/demo', projectName: 'Demo', projectColor: 'blue', prompt: 'Build the editor', status: 'working', filesChanged: [], fullLog: [], costUsd: 0, turnCount: 0, startedAt: 0, updatedAt: 0, lastActivityAt: 0 }

describe('conversation context cards', () => {
  it('updates the open summary live and explains stopped sessions and paused queues accurately', () => {
    const { rerender } = render(<ConversationContext item={item} />)
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }))
    expect(screen.getByText(/Working on your request/)).toBeTruthy()
    rerender(<ConversationContext item={{ ...item, stopped: true, status: 'awaiting_input', latestRequest: 'Fix the preview', pendingInput: 'Then add export', queuePaused: true }} />)
    expect(screen.getByText(/Stopped. Send a message/)).toBeTruthy()
    expect(screen.getByText('Fix the preview')).toBeTruthy()
    expect(screen.getByText(/Queue paused/)).toBeTruthy()
    expect(screen.getByText('Then add export')).toBeTruthy()
  })
  it('opens a site only on click and copies exact file paths without sending a conversation message', () => {
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: { openExternal: vi.fn(), writeClipboard: vi.fn() } })
    render(<ConversationContext item={{ ...item, resources: [{ kind: 'site', value: 'https://example.com/editor', evidence: 'tool' }, { kind: 'file', value: 'C:/demo/app.ts', evidence: 'changed' }] }} />)
    fireEvent.click(screen.getByRole('button', { name: /Files & sites/ }))
    expect(window.electronAPI.openExternal).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTitle('Open https://example.com/editor'))
    expect(window.electronAPI.openExternal).toHaveBeenCalledWith('https://example.com/editor')
    fireEvent.click(screen.getByTitle('Copy C:/demo/app.ts'))
    expect(window.electronAPI.writeClipboard).toHaveBeenCalledWith('C:/demo/app.ts')
  })
})
