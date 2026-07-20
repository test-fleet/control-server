import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

// Minimal inline trend chart for KPI tiles / table cells. `data` is an array
// of numbers (or objects if `dataKey` is given). No axes/grid/tooltip — this
// is a glance-value, not an analysis chart.
export default function Sparkline({ data, dataKey = 'v', color = 'var(--blue)', height = 24 }) {
  if (!data || data.length < 2) return null
  const points = typeof data[0] === 'object' ? data : data.map(v => ({ [dataKey]: v }))
  const id = `spark-${dataKey}-${color.replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Small run-history dot trail — used where a full sparkline is overkill
// (e.g. a table row) but recent pass/fail pattern still matters at a glance.
export function RunDotTrail({ runs = [], max = 8 }) {
  const recent = runs.slice(0, max).reverse()
  if (recent.length === 0) return <span className="text-muted monospace" style={{ fontSize: 11 }}>—</span>
  return (
    <span className="run-dot-trail">
      {recent.map((status, i) => (
        <span
          key={i}
          className="run-dot"
          style={{
            background: status === 'passed' ? 'var(--success)' : status === 'error' ? 'var(--peach)' : 'var(--error)',
            opacity: 0.4 + (0.6 * (i + 1)) / recent.length,
          }}
        />
      ))}
    </span>
  )
}
