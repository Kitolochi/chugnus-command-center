import { useSessionsStore } from '../../store'
import SessionHeatmap from './SessionHeatmap'
import ActivityChart from './ActivityChart'
import HourOfWeekGrid from './HourOfWeekGrid'

export default function OverviewView() {
  const { summary, heatmap, projects, topSessions, activity, hourOfWeek, loading } = useSessionsStore()

  if (loading && !summary) {
    return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Sessions', value: summary.total_sessions.toLocaleString() },
            { label: 'Messages', value: summary.total_messages.toLocaleString() },
            { label: 'Projects', value: summary.active_projects },
            { label: 'Active Days', value: summary.active_days },
            { label: 'Avg Msgs/Session', value: `${summary.median_messages} / ${summary.p90_messages}`, sub: 'med / p90' },
            { label: 'Concentration', value: `${(summary.concentration * 100).toFixed(1)}%` },
          ].map((card, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">{card.label}</div>
              <div className="text-xl font-semibold text-white">{card.value}</div>
              {card.sub && <div className="text-[10px] text-muted mt-0.5">{card.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Activity Timeline */}
      {activity?.series && activity.series.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">Activity Timeline</h3>
          <ActivityChart series={activity.series} />
        </div>
      )}

      {/* Activity Heatmap */}
      {heatmap?.entries && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">Activity</h3>
          <div className="overflow-x-auto">
            <SessionHeatmap entries={heatmap.entries} />
          </div>
        </div>
      )}

      {/* Hour-of-Week Heatmap */}
      {hourOfWeek?.cells && hourOfWeek.cells.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">When You Code</h3>
          <HourOfWeekGrid cells={hourOfWeek.cells} />
        </div>
      )}

      {/* Projects Table */}
      {projects?.projects && projects.projects.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">Projects</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-4 font-medium">Project</th>
                  <th className="text-right py-2 px-3 font-medium">Sessions</th>
                  <th className="text-right py-2 px-3 font-medium">Messages</th>
                  <th className="text-right py-2 px-3 font-medium">Avg Msgs</th>
                  <th className="text-left py-2 px-3 font-medium">Last Active</th>
                  <th className="py-2 pl-3 font-medium w-32"></th>
                </tr>
              </thead>
              <tbody>
                {projects.projects.map((p) => {
                  const maxMsgs = Math.max(...projects.projects.map(pp => pp.messages))
                  const pct = (p.messages / maxMsgs) * 100
                  return (
                    <tr key={p.name} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2.5 pr-4 text-white font-medium">{p.name}</td>
                      <td className="py-2.5 px-3 text-right text-muted">{p.sessions}</td>
                      <td className="py-2.5 px-3 text-right text-white">{p.messages.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-muted">{p.avg_messages.toFixed(0)}</td>
                      <td className="py-2.5 px-3 text-muted">{p.last_session}</td>
                      <td className="py-2.5 pl-3">
                        <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="h-full bg-accent-blue/50 rounded-full" style={{ width: `${pct}%` }} />
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

      {/* Top Sessions */}
      {topSessions?.sessions && topSessions.sessions.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-medium text-white/80 mb-4">Top Sessions</h3>
          <div className="space-y-2">
            {topSessions.sessions.slice(0, 10).map((s, i) => (
              <div key={s.id} className="flex items-start gap-3 py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-xs font-medium text-muted w-5 text-right shrink-0 mt-0.5">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-white/80 truncate">{s.first_message.slice(0, 80)}</div>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted">
                    <span>{s.project}</span>
                    <span>{s.message_count} msgs</span>
                    <span>{Math.round(s.duration_min)}m</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
