import { usePomodoroStore } from '../store'

const PRESETS: [number, number][] = [[25, 5], [30, 5], [45, 10]]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PomodoroTab() {
  const {
    mode, timeLeft, isRunning, focusDuration, breakDuration,
    sessionsCompleted, history, start, pause, resume, skip, reset, setPreset,
  } = usePomodoroStore()

  const totalSeconds = mode === 'focus' ? focusDuration * 60 : mode === 'break' ? breakDuration * 60 : 0
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0

  // SVG ring
  const size = 240
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  const accentColor = mode === 'break' ? 'accent-purple' : 'accent-teal'
  const ringColor = mode === 'break' ? '#a78bfa' : '#2dd4bf'

  return (
    <div className="h-full flex flex-col items-center justify-center gap-8 p-8 select-none">
      {/* Timer ring */}
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={mode === 'idle' ? 'rgba(255,255,255,0.1)' : ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="progress-ring-circle"
            style={isRunning ? {
              filter: `drop-shadow(0 0 8px ${ringColor}40) drop-shadow(0 0 20px ${ringColor}20)`,
            } : undefined}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span className="font-mono text-5xl font-bold tracking-wider text-white/90">
            {mode === 'idle' ? formatTime(focusDuration * 60) : formatTime(timeLeft)}
          </span>
          <span className={`text-xs font-accent tracking-widest uppercase mt-2 ${
            mode === 'focus' ? `text-${accentColor}` :
            mode === 'break' ? `text-${accentColor}` :
            'text-muted'
          }`}>
            {mode === 'idle' ? 'ready' : mode}
          </span>
        </div>
      </div>

      {/* Preset pills */}
      <div className="flex gap-2">
        {PRESETS.map(([f, b]) => {
          const active = focusDuration === f && breakDuration === b
          return (
            <button
              key={`${f}/${b}`}
              onClick={() => setPreset(f, b)}
              disabled={mode !== 'idle'}
              className={`px-3 py-1.5 rounded-full text-xs font-accent tracking-wide transition-all duration-200 ${
                active
                  ? 'bg-accent-teal/20 text-accent-teal border border-accent-teal/30'
                  : 'bg-white/[0.04] text-muted hover:text-white/70 hover:bg-white/[0.08] border border-white/[0.06]'
              } ${mode !== 'idle' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {f}/{b}
            </button>
          )
        })}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {mode === 'idle' && (
          <button onClick={start} className="px-6 py-2.5 rounded-lg bg-accent-teal/20 text-accent-teal border border-accent-teal/30 font-accent text-sm tracking-wide hover:bg-accent-teal/30 transition-all duration-200">
            Start
          </button>
        )}
        {mode !== 'idle' && !isRunning && (
          <button onClick={resume} className="px-6 py-2.5 rounded-lg bg-accent-teal/20 text-accent-teal border border-accent-teal/30 font-accent text-sm tracking-wide hover:bg-accent-teal/30 transition-all duration-200">
            Resume
          </button>
        )}
        {mode !== 'idle' && isRunning && (
          <button onClick={pause} className="px-6 py-2.5 rounded-lg bg-white/[0.06] text-white/70 border border-white/[0.08] font-accent text-sm tracking-wide hover:bg-white/[0.1] transition-all duration-200">
            Pause
          </button>
        )}
        {mode !== 'idle' && (
          <>
            <button onClick={skip} className="px-4 py-2.5 rounded-lg bg-white/[0.04] text-muted border border-white/[0.06] font-accent text-sm tracking-wide hover:text-white/70 hover:bg-white/[0.08] transition-all duration-200">
              Skip
            </button>
            <button onClick={reset} className="px-4 py-2.5 rounded-lg bg-white/[0.04] text-muted border border-white/[0.06] font-accent text-sm tracking-wide hover:text-white/70 hover:bg-white/[0.08] transition-all duration-200">
              Reset
            </button>
          </>
        )}
      </div>

      {/* Session counter */}
      {sessionsCompleted > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-accent tracking-wide">Sessions</span>
          <span className="px-2 py-0.5 rounded-full bg-accent-teal/20 text-accent-teal text-xs font-mono font-bold">
            {sessionsCompleted}
          </span>
        </div>
      )}

      {/* Mini history */}
      {history.length > 0 && (
        <div className="w-full max-w-xs space-y-1">
          <span className="text-[10px] text-muted font-accent tracking-widest uppercase">Recent</span>
          {history.slice(-5).reverse().map((entry, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${entry.mode === 'focus' ? 'bg-accent-teal' : 'bg-accent-purple'}`} />
                <span className="text-[11px] text-white/60 font-accent">{entry.mode}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted font-mono">{entry.duration}m</span>
                <span className={`text-[10px] ${entry.completed ? 'text-accent-emerald' : 'text-accent-amber'}`}>
                  {entry.completed ? 'done' : 'skipped'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
