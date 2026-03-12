interface Props {
  buckets: { label: string; count: number }[]
  color: string
  title: string
}

export default function HistogramChart({ buckets, color, title }: Props) {
  const max = Math.max(...buckets.map(b => b.count), 1)
  const barWidth = Math.max(24, Math.floor(200 / buckets.length))

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <h4 className="text-xs font-medium text-muted mb-4">{title}</h4>
      <svg
        viewBox={`0 0 ${buckets.length * (barWidth + 8) + 16} 140`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {buckets.map((b, i) => {
          const barHeight = (b.count / max) * 100
          const x = i * (barWidth + 8) + 8
          return (
            <g key={i}>
              {/* Count label */}
              <text
                x={x + barWidth / 2}
                y={115 - barHeight - 4}
                textAnchor="middle"
                className="text-[9px]"
                fill="rgba(255,255,255,0.5)"
              >
                {b.count}
              </text>
              {/* Bar */}
              <rect
                x={x}
                y={115 - barHeight}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill={color}
                opacity={0.7}
              />
              {/* Label */}
              <text
                x={x + barWidth / 2}
                y={130}
                textAnchor="middle"
                className="text-[8px]"
                fill="rgba(255,255,255,0.4)"
              >
                {b.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
