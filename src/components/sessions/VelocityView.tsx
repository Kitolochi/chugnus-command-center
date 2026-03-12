import { useSessionsStore } from '../../store'

export default function VelocityView() {
  const { velocity, loading } = useSessionsStore()

  if (loading && !velocity) {
    return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" /></div>
  }

  if (!velocity) return null

  const { overall, by_complexity } = velocity

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Turn Cycle (p50/p90)', value: `${overall.turn_cycle_sec.p50}s / ${overall.turn_cycle_sec.p90}s` },
          { label: 'First Response (p50/p90)', value: `${overall.first_response_sec.p50}s / ${overall.first_response_sec.p90}s` },
          { label: 'Msgs / Active Min', value: overall.msgs_per_active_min.toFixed(1) },
          { label: 'Chars / Active Min', value: overall.chars_per_active_min.toFixed(0) },
          { label: 'Tool Calls / Active Min', value: overall.tool_calls_per_active_min.toFixed(1) },
        ].map((card, i) => (
          <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[10px] text-muted uppercase tracking-wider mb-1">{card.label}</div>
            <div className="text-lg font-semibold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* By complexity table */}
      {by_complexity && by_complexity.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">By Complexity (message count)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-4 font-medium">Bucket</th>
                  <th className="text-right py-2 px-3 font-medium">Sessions</th>
                  <th className="text-right py-2 px-3 font-medium">Turn Cycle p50</th>
                  <th className="text-right py-2 px-3 font-medium">Turn Cycle p90</th>
                  <th className="text-right py-2 px-3 font-medium">Msgs/Min</th>
                  <th className="text-right py-2 px-3 font-medium">Chars/Min</th>
                  <th className="py-2 pl-3 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {by_complexity.map((row) => {
                  const maxMsgsMin = Math.max(...by_complexity.map(r => r.overview.msgs_per_active_min), 1)
                  const pct = (row.overview.msgs_per_active_min / maxMsgsMin) * 100
                  return (
                    <tr key={row.label} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2.5 pr-4 text-white font-medium">{row.label} msgs</td>
                      <td className="py-2.5 px-3 text-right text-muted">{row.sessions}</td>
                      <td className="py-2.5 px-3 text-right text-white">{row.overview.turn_cycle_sec.p50}s</td>
                      <td className="py-2.5 px-3 text-right text-muted">{row.overview.turn_cycle_sec.p90}s</td>
                      <td className="py-2.5 px-3 text-right text-white">{row.overview.msgs_per_active_min.toFixed(1)}</td>
                      <td className="py-2.5 px-3 text-right text-muted">{row.overview.chars_per_active_min.toFixed(0)}</td>
                      <td className="py-2.5 pl-3">
                        <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="h-full bg-accent-purple/50 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
