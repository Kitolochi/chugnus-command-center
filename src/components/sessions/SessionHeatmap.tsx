import { useMemo, useState } from 'react'
import type { AVHeatmapEntry } from '../../types'

const LEVEL_COLORS = [
  'bg-white/[0.03]',
  'bg-accent-blue/20',
  'bg-accent-blue/40',
  'bg-accent-blue/60',
  'bg-accent-blue/80',
]

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Props {
  entries: AVHeatmapEntry[]
}

export default function SessionHeatmap({ entries }: Props) {
  const [tooltip, setTooltip] = useState<{ date: string; value: number; x: number; y: number } | null>(null)

  const { weeks, monthLabels } = useMemo(() => {
    if (!entries.length) return { weeks: [], monthLabels: [] }

    const byDate = new Map(entries.map(e => [e.date, e]))
    const first = new Date(entries[0].date)
    const last = new Date(entries[entries.length - 1].date)

    // Align to Monday
    const start = new Date(first)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))

    const weeks: { date: string; value: number; level: number; dayOfWeek: number }[][] = []
    const monthLabels: { label: string; weekIndex: number }[] = []
    let currentWeek: typeof weeks[0] = []
    let lastMonth = -1
    let weekIndex = 0

    const cursor = new Date(start)
    while (cursor <= last) {
      const dateStr = cursor.toISOString().slice(0, 10)
      const entry = byDate.get(dateStr)
      const dayOfWeek = (cursor.getDay() + 6) % 7 // Mon=0

      currentWeek.push({
        date: dateStr,
        value: entry?.value ?? 0,
        level: entry?.level ?? 0,
        dayOfWeek,
      })

      if (dayOfWeek === 0 && cursor.getMonth() !== lastMonth) {
        monthLabels.push({ label: MONTHS[cursor.getMonth()], weekIndex })
        lastMonth = cursor.getMonth()
      }

      if (dayOfWeek === 6) {
        weeks.push(currentWeek)
        currentWeek = []
        weekIndex++
      }

      cursor.setDate(cursor.getDate() + 1)
    }
    if (currentWeek.length) weeks.push(currentWeek)

    return { weeks, monthLabels }
  }, [entries])

  if (!entries.length) return null

  return (
    <div className="relative">
      {/* Month labels */}
      <div className="flex ml-8 mb-1 text-[10px] text-muted" style={{ gap: 0 }}>
        {monthLabels.map((m, i) => (
          <span key={i} style={{ position: 'absolute', left: `${m.weekIndex * 14 + 32}px` }}>
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex gap-[2px] mt-5">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px] mr-1">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="h-[12px] flex items-center text-[9px] text-muted w-6 justify-end pr-1">
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[2px]">
            {Array.from({ length: 7 }, (_, di) => {
              const cell = week.find(c => c.dayOfWeek === di)
              if (!cell) return <div key={di} className="w-[12px] h-[12px]" />
              return (
                <div
                  key={di}
                  className={`w-[12px] h-[12px] rounded-[2px] ${LEVEL_COLORS[cell.level]} cursor-pointer transition-all hover:ring-1 hover:ring-white/20`}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltip({ date: cell.date, value: cell.value, x: rect.left, y: rect.top })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-surface-3 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white shadow-lg pointer-events-none"
          style={{ left: tooltip.x - 40, top: tooltip.y - 40 }}
        >
          <span className="font-medium">{tooltip.value}</span> messages on {tooltip.date}
        </div>
      )}
    </div>
  )
}
