import { useMemo, useState } from 'react'
import type { AVHourOfWeekCell } from '../../types'

interface Props {
  cells: AVHourOfWeekCell[]
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function HourOfWeekGrid({ cells }: Props) {
  const [hovered, setHovered] = useState<{ day: number; hour: number } | null>(null)

  const { grid, max } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    let m = 1
    for (const c of cells) {
      g[c.day_of_week][c.hour] = c.messages
      if (c.messages > m) m = c.messages
    }
    return { grid: g, max: m }
  }, [cells])

  if (cells.length === 0) {
    return <div className="text-xs text-muted text-center py-6">No hour-of-week data</div>
  }

  const getColor = (val: number) => {
    if (val === 0) return 'bg-white/[0.03]'
    const pct = val / max
    if (pct < 0.2) return 'bg-accent-blue/20'
    if (pct < 0.4) return 'bg-accent-blue/40'
    if (pct < 0.6) return 'bg-accent-blue/60'
    if (pct < 0.8) return 'bg-accent-blue/80'
    return 'bg-accent-blue'
  }

  const hoveredCell = hovered ? grid[hovered.day]?.[hovered.hour] : null

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        {/* Hour labels */}
        <div className="flex ml-9 mb-1 gap-px">
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="text-[8px] text-white/30 text-center"
              style={{ width: 18, minWidth: 18 }}
            >
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAYS.map((day, di) => (
          <div key={day} className="flex items-center gap-px mb-px">
            <div className="w-8 text-[9px] text-white/40 text-right pr-1 shrink-0">{day}</div>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className={`rounded-[2px] cursor-default transition-colors ${getColor(grid[di][h])}`}
                style={{ width: 18, height: 18, minWidth: 18 }}
                onMouseEnter={() => setHovered({ day: di, hour: h })}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hovered && hoveredCell !== null && (
        <div className="absolute top-0 right-0 bg-surface-2 border border-white/[0.08] rounded-lg px-3 py-2 text-[10px] pointer-events-none z-10">
          <div className="text-white font-medium">{DAYS[hovered.day]} {hovered.hour}:00</div>
          <div className="text-muted">{hoveredCell} messages</div>
        </div>
      )}
    </div>
  )
}
