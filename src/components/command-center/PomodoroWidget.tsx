import { usePomodoroStore } from '../../store'

const PRESETS: [number, number][] = [[25, 5], [30, 5], [45, 10]]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PomodoroWidget() {
  const {
    mode, timeLeft, isRunning, focusDuration, breakDuration,
    sessionsCompleted, start, pause, resume, skip, reset, setPreset,
  } = usePomodoroStore()

  const totalSeconds = mode === 'focus' ? focusDuration * 60 : mode === 'break' ? breakDuration * 60 : 0
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0

  const ringSize = 36
  const sw = 3
  const r = (ringSize - sw) / 2
  const circ = 2 * Math.PI * r
  const dashOffset = circ * (1 - progress)
  const ringColor = mode === 'break' ? '#a78bfa' : '#2dd4bf'

  return (
    <div className="flex items-center gap-3 bg-surface-2/80 rounded-lg px-3 py-2 border border-white/[0.06]">
      {/* Mini ring + time */}
      <div className="relative flex-shrink-0">
        <svg width={ringSize} height={ringSize} className="-rotate-90">
          <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
          <circle
            cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none"
            stroke={mode === 'idle' ? 'rgba(255,255,255,0.1)' : ringColor}
            strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={dashOffset}
            className="progress-ring-circle"
            style={isRunning ? { filter: `drop-shadow(0 0 4px ${ringColor}60)` } : undefined}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-bold text-white/70">
          {mode === 'idle' ? formatTime(focusDuration * 60) : formatTime(timeLeft)}
        </span>
      </div>

      {/* Presets (only when idle) */}
      {mode === 'idle' && (
        <div className="flex gap-1">
          {PRESETS.map(([f, b]) => (
            <button
              key={`${f}/${b}`}
              onClick={() => setPreset(f, b)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all ${
                focusDuration === f && breakDuration === b
                  ? 'bg-accent-teal/20 text-accent-teal'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {f}/{b}
            </button>
          ))}
        </div>
      )}

      {/* Mode label when running */}
      {mode !== 'idle' && (
        <span className={`text-[10px] font-accent tracking-wide ${mode === 'focus' ? 'text-accent-teal' : 'text-accent-purple'}`}>
          {mode === 'focus' ? 'Focus' : 'Break'}
        </span>
      )}

      {/* Controls */}
      {mode === 'idle' ? (
        <button onClick={start} className="px-2.5 py-1 rounded-md bg-accent-teal/15 text-accent-teal text-[10px] font-accent tracking-wide hover:bg-accent-teal/25 transition-all">
          Start
        </button>
      ) : (
        <div className="flex gap-1">
          {isRunning ? (
            <button onClick={pause} className="px-2 py-1 rounded-md bg-white/[0.06] text-white/50 text-[10px] font-accent hover:bg-white/[0.1] transition-all">
              Pause
            </button>
          ) : (
            <button onClick={resume} className="px-2 py-1 rounded-md bg-accent-teal/15 text-accent-teal text-[10px] font-accent hover:bg-accent-teal/25 transition-all">
              Go
            </button>
          )}
          <button onClick={skip} className="px-1.5 py-1 rounded-md text-white/30 text-[10px] font-accent hover:text-white/50 transition-all">
            Skip
          </button>
          <button onClick={reset} className="px-1.5 py-1 rounded-md text-white/30 text-[10px] font-accent hover:text-white/50 transition-all">
            Reset
          </button>
        </div>
      )}

      {/* Session count */}
      {sessionsCompleted > 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-accent-teal/15 text-accent-teal text-[10px] font-mono font-bold">
          {sessionsCompleted}
        </span>
      )}
    </div>
  )
}
