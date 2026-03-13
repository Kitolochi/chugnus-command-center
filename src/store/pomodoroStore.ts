import { create } from 'zustand'

type PomodoroMode = 'idle' | 'focus' | 'break'

interface SessionRecord {
  startedAt: number
  duration: number
  mode: 'focus' | 'break'
  completed: boolean
}

interface PomodoroState {
  mode: PomodoroMode
  timeLeft: number
  isRunning: boolean
  focusDuration: number
  breakDuration: number
  sessionsCompleted: number
  history: SessionRecord[]

  start: () => void
  pause: () => void
  resume: () => void
  skip: () => void
  reset: () => void
  tick: () => void
  setPreset: (focus: number, break_: number) => void
}

let intervalId: ReturnType<typeof setInterval> | null = null

function clearTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function startTimer() {
  clearTimer()
  intervalId = setInterval(() => {
    usePomodoroStore.getState().tick()
  }, 1000)
}

function notify(title: string, body: string) {
  try {
    window.electronAPI.showNotification(title, body)
  } catch {
    // silent — notifications are best-effort
  }
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  mode: 'idle',
  timeLeft: 0,
  isRunning: false,
  focusDuration: 30,
  breakDuration: 5,
  sessionsCompleted: 0,
  history: [],

  start: () => {
    const { focusDuration } = get()
    set({
      mode: 'focus',
      timeLeft: focusDuration * 60,
      isRunning: true,
    })
    startTimer()
  },

  pause: () => {
    clearTimer()
    set({ isRunning: false })
  },

  resume: () => {
    set({ isRunning: true })
    startTimer()
  },

  skip: () => {
    const { mode, breakDuration, focusDuration, history } = get()
    if (mode === 'focus') {
      // Skip focus → go to break
      set({
        mode: 'break',
        timeLeft: breakDuration * 60,
        history: [...history, { startedAt: Date.now(), duration: focusDuration, mode: 'focus', completed: false }],
      })
      notify('Break time', 'Focus session skipped. Take a break!')
    } else if (mode === 'break') {
      // Skip break → go to idle
      clearTimer()
      set(s => ({
        mode: 'idle',
        timeLeft: 0,
        isRunning: false,
        sessionsCompleted: s.sessionsCompleted + 1,
        history: [...s.history, { startedAt: Date.now(), duration: breakDuration, mode: 'break', completed: false }],
      }))
      notify('Ready', 'Break skipped. Ready for another session!')
    }
  },

  reset: () => {
    clearTimer()
    set({
      mode: 'idle',
      timeLeft: 0,
      isRunning: false,
    })
  },

  tick: () => {
    const { timeLeft, mode, breakDuration, focusDuration, history } = get()
    if (timeLeft <= 1) {
      if (mode === 'focus') {
        // Focus done → start break
        set({
          mode: 'break',
          timeLeft: breakDuration * 60,
          history: [...history, { startedAt: Date.now(), duration: focusDuration, mode: 'focus', completed: true }],
        })
        notify('Break time!', `${focusDuration} min focus complete. ${breakDuration} min break starting.`)
      } else if (mode === 'break') {
        // Break done → idle
        clearTimer()
        set(s => ({
          mode: 'idle',
          timeLeft: 0,
          isRunning: false,
          sessionsCompleted: s.sessionsCompleted + 1,
          history: [...s.history, { startedAt: Date.now(), duration: breakDuration, mode: 'break', completed: true }],
        }))
        notify('Session complete!', 'Break over. Ready for another round?')
      }
    } else {
      set({ timeLeft: timeLeft - 1 })
    }
  },

  setPreset: (focus, break_) => {
    const { mode } = get()
    if (mode === 'idle') {
      set({ focusDuration: focus, breakDuration: break_ })
    }
  },
}))
