import { useSessionsStore } from '../../store'

const ACCENT_COLORS = [
  'bg-accent-blue', 'bg-accent-purple', 'bg-accent-emerald', 'bg-amber-400',
  'bg-rose-400', 'bg-orange-400', 'bg-teal-400', 'bg-sky-400', 'bg-violet-400',
]

export default function ToolsView() {
  const { tools, loading } = useSessionsStore()

  if (loading && !tools) {
    return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" /></div>
  }

  if (!tools) return null

  const maxCount = Math.max(...tools.by_category.map(c => c.count), 1)

  return (
    <div className="space-y-6">
      {/* Total tool calls */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 w-fit">
        <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Total Tool Calls</div>
        <div className="text-2xl font-semibold text-white">{tools.total_calls.toLocaleString()}</div>
      </div>

      {/* Tool breakdown bars */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
        <h3 className="text-sm font-medium text-white/80 mb-4">Tool Breakdown</h3>
        <div className="space-y-2.5">
          {tools.by_category.map((cat, i) => (
            <div key={cat.category} className="flex items-center gap-3">
              <span className="text-xs text-muted w-14 text-right shrink-0">{cat.category}</span>
              <div className="flex-1 h-5 bg-white/[0.03] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${ACCENT_COLORS[i % ACCENT_COLORS.length]} opacity-60 transition-all duration-500`}
                  style={{ width: `${(cat.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs text-white/70 w-20 text-right shrink-0">
                {cat.count.toLocaleString()} <span className="text-muted">({cat.pct}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly trend */}
      {tools.trend && tools.trend.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">Weekly Trend</h3>
          <div className="flex items-end gap-3 h-40">
            {tools.trend.map((week) => {
              const total = Object.values(week.by_category).reduce((a, b) => a + b, 0)
              const maxWeekTotal = Math.max(...tools.trend.map(w => Object.values(w.by_category).reduce((a, b) => a + b, 0)), 1)
              const heightPct = (total / maxWeekTotal) * 100
              return (
                <div key={week.date} className="flex flex-col items-center flex-1 gap-1">
                  <span className="text-[9px] text-muted">{total.toLocaleString()}</span>
                  <div className="w-full bg-white/[0.03] rounded-t-md overflow-hidden" style={{ height: '120px' }}>
                    <div
                      className="w-full bg-accent-blue/50 rounded-t-md transition-all duration-500"
                      style={{ height: `${heightPct}%`, marginTop: `${100 - heightPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted">{week.date.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
