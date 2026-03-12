import { useMemo, useState } from 'react'
import type { AVActivitySeries } from '../../types'

interface Props {
  series: AVActivitySeries[]
}

export default function ActivityChart({ series }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const maxMessages = useMemo(
    () => Math.max(1, ...series.map(s => s.messages)),
    [series]
  )

  if (series.length === 0) {
    return <div className="text-xs text-muted text-center py-6">No activity data</div>
  }

  // Show up to 90 bars; if more, sample every Nth
  const step = series.length > 90 ? Math.ceil(series.length / 90) : 1
  const visible = step > 1 ? series.filter((_, i) => i % step === 0) : series

  const barWidth = Math.max(4, Math.min(14, Math.floor(700 / visible.length) - 2))
  const chartWidth = visible.length * (barWidth + 2)
  const chartHeight = 120

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight + 28} className="block">
          {/* Bars */}
          {visible.map((d, i) => {
            const h = (d.messages / maxMessages) * chartHeight
            const x = i * (barWidth + 2)
            const y = chartHeight - h
            const isHovered = hoveredIdx === i

            return (
              <g
                key={d.date}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  rx={2}
                  className={isHovered ? 'fill-accent-blue' : 'fill-accent-blue/60'}
                />
                {/* Date label — show every ~7th */}
                {(i % Math.max(1, Math.floor(visible.length / 10)) === 0) && (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 14}
                    textAnchor="middle"
                    className="fill-white/30 text-[8px]"
                  >
                    {d.date.slice(5)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredIdx !== null && visible[hoveredIdx] && (
        <div className="absolute top-0 right-0 bg-surface-2 border border-white/[0.08] rounded-lg px-3 py-2 text-[10px] space-y-0.5 pointer-events-none z-10">
          <div className="text-white font-medium">{visible[hoveredIdx].date}</div>
          <div className="text-muted">{visible[hoveredIdx].messages} messages</div>
          <div className="text-muted">{visible[hoveredIdx].sessions} sessions</div>
          <div className="text-muted">{visible[hoveredIdx].tool_calls} tool calls</div>
        </div>
      )}
    </div>
  )
}
