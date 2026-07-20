import MethodBadge from './MethodBadge'

function frameColor(status) {
  if (status === 'passed') return 'var(--success)'
  if (status === 'error') return 'var(--peach)'
  if (status === 'not_executed') return 'var(--border-bright)'
  return 'var(--error)'
}

// Horizontal timeline of a run's frame executions, proportional to duration —
// the fastest way to see which step in a scene ate the time or broke.
export default function Waterfall({ frames, selectedId, onSelect }) {
  const durations = frames.map(f => f.durationMs || 0)
  const max = Math.max(1, ...durations)

  return (
    <div>
      {frames.map(frame => {
        const color = frameColor(frame.status)
        const widthPct = frame.status === 'not_executed' ? 0 : Math.max(2, (100 * (frame.durationMs || 0)) / max)
        const isSelected = selectedId === frame._key
        return (
          <div
            key={frame._key}
            className="waterfall-row"
            onClick={() => onSelect(frame._key)}
            style={{ cursor: 'pointer', background: isSelected ? 'var(--surface-hover)' : undefined, borderRadius: 6 }}
          >
            <div className="waterfall-label">
              <span className="text-muted monospace" style={{ fontSize: 10, minWidth: 14, textAlign: 'right' }}>{frame.order}</span>
              <MethodBadge method={frame.request?.method} />
              <span className="truncate" style={{ fontWeight: 500 }}>{frame.name}</span>
            </div>
            <div className="waterfall-track">
              {frame.status === 'not_executed' ? (
                <span className="text-muted monospace" style={{ fontSize: 10, paddingLeft: 6, lineHeight: '18px' }}>skipped</span>
              ) : (
                <div className="waterfall-bar" style={{ left: 0, width: `${widthPct}%`, background: color }} />
              )}
            </div>
            <div className="waterfall-duration">
              {frame.status === 'not_executed' ? '—' : `${frame.durationMs ?? 0}ms`}
            </div>
          </div>
        )
      })}
    </div>
  )
}
