import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CodexComposer from './CodexComposer'
import { useCodexStore } from '../../store/codexStore'
import type { CodexSession } from '../../types/codex'

const session: CodexSession = {
  id: 'task', projectPath: 'C:/demo', title: 'Working task', model: 'live-model', effort: 'high', access: 'read-only',
  status: 'working', archived: false, messages: [], activity: [], filesChanged: [], tokensIn: 0, tokensOut: 0,
  turns: 0, createdAt: 1, updatedAt: 2,
}
const settings = { defaultModel: 'live-model', defaultEffort: 'high', models: [{ model: 'live-model', displayName: 'Live model', efforts: [{ value: 'high', description: '' }], defaultEffort: 'high' }] }
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() })
  useCodexStore.setState({ drafts: {}, sessions: [session], sending: false, error: null })
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { codexModelSettings: vi.fn().mockResolvedValue(settings), codexTurn: vi.fn().mockResolvedValue(session) } })
})
afterEach(cleanup)

describe('always available Codex input', () => {
  it('allows typing while working and preserves new typing during the send request', async () => {
    let finish!: (value: CodexSession) => void
    vi.mocked(window.electronAPI.codexTurn).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<CodexComposer session={session} />)
    const input = screen.getByRole('textbox', { name: 'Message Codex' }) as HTMLTextAreaElement
    expect(input.disabled).toBe(false)
    fireEvent.change(input, { target: { value: 'First follow-up' } })
    const send = screen.getByRole('button', { name: 'Send to Codex' }) as HTMLButtonElement
    await waitFor(() => expect(send.disabled).toBe(false))
    fireEvent.click(send)
    expect(input.disabled).toBe(false)
    fireEvent.change(input, { target: { value: 'Keep this newer draft' } })
    finish(session)
    await waitFor(() => expect(useCodexStore.getState().sending).toBe(false))
    expect(input.value).toBe('Keep this newer draft')
    expect(window.electronAPI.codexTurn).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'task', prompt: 'First follow-up' }))
  })
  it('keeps separate drafts across card unmounts', async () => {
    const first = render(<CodexComposer session={session} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Message Codex' }), { target: { value: 'Unsent draft' } })
    first.unmount()
    const second = render(<CodexComposer session={{ ...session, id: 'other' }} />)
    expect((screen.getByRole('textbox', { name: 'Message Codex' }) as HTMLTextAreaElement).value).toBe('')
    second.unmount()
    render(<CodexComposer session={session} />)
    expect((screen.getByRole('textbox', { name: 'Message Codex' }) as HTMLTextAreaElement).value).toBe('Unsent draft')
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Codex model' }) as HTMLSelectElement).disabled).toBe(false))
  })
  it('restores a rejected message without erasing text typed while sending', async () => {
    let reject!: (error: Error) => void
    vi.mocked(window.electronAPI.codexTurn).mockImplementation(() => new Promise((_resolve, fail) => { reject = fail }))
    render(<CodexComposer session={session} />)
    const input = screen.getByRole('textbox', { name: 'Message Codex' }) as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'Failed message' } })
    const send = screen.getByRole('button', { name: 'Send to Codex' }) as HTMLButtonElement
    await waitFor(() => expect(send.disabled).toBe(false))
    fireEvent.click(send)
    fireEvent.change(input, { target: { value: 'New draft' } })
    reject(new Error('Connection failed'))
    await waitFor(() => expect(input.value).toBe('Failed message\nNew draft'))
  })
})
