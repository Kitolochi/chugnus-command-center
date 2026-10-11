import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FocusCard from './FocusCard'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import type { CCQueueItem } from '../../store/commandCenterStore'

const item: CCQueueItem = {
  processId: 'p1',
  sessionId: 's1',
  projectPath: 'C:/demo',
  projectName: 'Demo',
  projectColor: 'blue',
  prompt: 'Build the editor',
  status: 'awaiting_input',
  filesChanged: [],
  fullLog: [],
  costUsd: 0,
  turnCount: 0,
  startedAt: 0,
  updatedAt: 0,
  lastActivityAt: 0,
  model: 'claude-fable-5-1',
  effort: 'high',
}

const kill = vi.fn()
const launch = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: {} })
  useCommandCenterStore.setState({ kill, launch } as never)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('ultracode toggle', () => {
  it('turns ultracode on by restarting the session with the same model and effort', () => {
    render(<FocusCard item={item} />)
    const toggle = screen.getByRole('switch', { name: 'Ultracode' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)
    expect(kill).toHaveBeenCalledWith('p1')
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(launch).toHaveBeenCalledWith('C:/demo', 'Continue where we left off.', {
      model: 'claude-fable-5-1',
      effort: 'high',
      ultracode: true,
      resumeSessionId: 's1',
    })
  })

  it('turns ultracode off when it is on', () => {
    render(<FocusCard item={{ ...item, ultracode: true }} />)
    const toggle = screen.getByRole('switch', { name: 'Ultracode' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(launch.mock.calls[0][2]).toMatchObject({ ultracode: false })
  })

  it('stays disabled while the session is working so a step is not cut off', () => {
    render(<FocusCard item={{ ...item, status: 'working' }} />)
    const toggle = screen.getByRole('switch', { name: 'Ultracode' }) as HTMLButtonElement
    expect(toggle.disabled).toBe(true)
    fireEvent.click(toggle)
    expect(kill).not.toHaveBeenCalled()
  })

  it('is hidden for Codex sessions', () => {
    render(<FocusCard item={{ ...item, provider: 'codex' }} />)
    expect(screen.queryByRole('switch', { name: 'Ultracode' })).toBeNull()
  })
})
