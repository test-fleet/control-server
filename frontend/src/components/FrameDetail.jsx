import { Fragment } from 'react'

const METHOD_COLORS = {
  GET:    { bg: 'rgba(0,200,120,0.12)',  color: '#00c878' },
  POST:   { bg: 'rgba(0,160,240,0.12)',  color: '#00a0f0' },
  PUT:    { bg: 'rgba(240,180,0,0.12)',  color: '#f0b400' },
  PATCH:  { bg: 'rgba(180,80,240,0.12)', color: '#b450f0' },
  DELETE: { bg: 'rgba(240,60,60,0.12)',  color: '#f03c3c' },
}

const OP_LABEL = {
  eq: '=', equals: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤',
  contains: 'contains', exists: 'exists',
}

function statusCodeColor(code) {
  if (!code) return 'var(--text-muted)'
  if (code < 300) return 'var(--success)'
  if (code < 400) return 'var(--blue)'
  if (code < 500) return 'var(--warning)'
  return 'var(--error)'
}

function frameStatusColor(s) {
  if (s === 'passed') return 'var(--success)'
  if (s === 'error')  return 'var(--peach)'
  return 'var(--error)'
}

function truncate(v, len = 80) {
  const s = v === null || v === undefined ? 'null' : String(v)
  return s.length > len ? s.slice(0, len) + '…' : s
}

function fmtVal(v) {
  if (v === null || v === undefined) return <span style={{ color: 'var(--text-muted)' }}>null</span>
  if (typeof v === 'string') return <span style={{ color: 'var(--lime)' }}>"{truncate(v, 60)}"</span>
  if (typeof v === 'boolean') return <span style={{ color: 'var(--peach)' }}>{String(v)}</span>
  return <span>{String(v)}</span>
}

function MethodBadge({ method }) {
  const c = METHOD_COLORS[method] || { bg: 'rgba(120,120,120,0.12)', color: 'var(--text-muted)' }
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 3,
      fontSize: 10, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.06em',
      background: c.bg, color: c.color, flexShrink: 0,
    }}>
      {method}
    </span>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      fontFamily: 'monospace', marginBottom: 6,
    }}>
      {children}
    </div>
  )
}

function HeaderTable({ headers }) {
  const entries = Object.entries(headers || {}).filter(([, v]) => v != null)
  if (entries.length === 0) return null
  return (
    <div style={{ marginTop: 6 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 10, fontSize: 11, fontFamily: 'monospace', marginBottom: 2 }}>
          <span style={{ color: 'var(--text-muted)', minWidth: 160, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {k}
          </span>
          <span style={{ color: 'var(--text-dim)', wordBreak: 'break-all' }}>{truncate(v, 120)}</span>
        </div>
      ))}
    </div>
  )
}

function FrameDetail({ frame }) {
  const assertions = frame.assertions || []
  const failedCount = assertions.filter(a => !a.passed).length

  return (
    <div style={{
      padding: '12px 14px 14px',
      marginBottom: 3,
      borderRadius: '0 0 4px 4px',
      background: 'var(--surface)',
      border: '1px solid var(--border-bright)',
      borderTop: 'none',
    }}>

      {/* Request */}
      <div style={{ marginBottom: 14 }}>
        <SectionLabel>Request</SectionLabel>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <MethodBadge method={frame.request?.method} />
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.5 }}>
            {frame.request?.url}
          </span>
        </div>
        <HeaderTable headers={frame.request?.headers} />
      </div>

      {/* Response */}
      <div style={{ marginBottom: assertions.length > 0 || frame.error ? 14 : 0 }}>
        <SectionLabel>Response</SectionLabel>
        {frame.response?.statusCode ? (
          <>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: statusCodeColor(frame.response.statusCode) }}>
                {frame.response.statusCode}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                {frame.response.durationMs}ms
              </span>
              {frame.response.bodySize > 0 && (
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  {frame.response.bodySize >= 1024
                    ? `${(frame.response.bodySize / 1024).toFixed(1)} KB`
                    : `${frame.response.bodySize} B`}
                </span>
              )}
            </div>
            <HeaderTable headers={frame.response.headers} />
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No response received</span>
        )}
      </div>

      {/* Assertions */}
      {assertions.length > 0 && (
        <div style={{ marginBottom: frame.error ? 14 : 0 }}>
          <SectionLabel>
            Assertions &mdash; {failedCount === 0 ? 'all passed' : `${failedCount} failed`}
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {assertions.map((a, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '14px 52px minmax(80px, 1fr) 70px minmax(60px, 1fr) 18px minmax(60px, 1fr)',
                gap: 6, alignItems: 'center',
                padding: '5px 8px',
                borderRadius: 3,
                background: a.passed ? 'rgba(168,224,48,0.04)' : 'rgba(240,96,96,0.06)',
                border: `1px solid ${a.passed ? 'rgba(168,224,48,0.12)' : 'rgba(240,96,96,0.25)'}`,
                fontSize: 11, fontFamily: 'monospace',
              }}>
                <span style={{ color: a.passed ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                  {a.passed ? '✓' : '✗'}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{a.type}</span>
                <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.source && a.type !== 'status' ? a.source : '—'}
                </span>
                <span style={{ color: 'var(--blue)', textAlign: 'center' }}>
                  {OP_LABEL[a.operator] ?? a.operator}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fmtVal(a.expected)}
                </span>
                <span style={{ color: 'var(--text-muted)', textAlign: 'center' }}>→</span>
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontWeight: !a.passed ? 600 : 400,
                  color: !a.passed ? 'var(--error)' : 'var(--text-dim)',
                }}>
                  {fmtVal(a.actual)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {frame.error && (
        <div>
          <SectionLabel>Error</SectionLabel>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--peach)', wordBreak: 'break-word', lineHeight: 1.6 }}>
            {frame.error}
          </div>
        </div>
      )}
    </div>
  )
}

export function FrameResultRow({ frame, expanded, onToggle }) {
  const color = frameStatusColor(frame.status)

  return (
    <Fragment>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 10px',
          borderRadius: expanded ? '4px 4px 0 0' : 4,
          marginBottom: expanded ? 0 : 2,
          background: expanded ? 'var(--surface-hover)' : 'var(--surface-raised)',
          border: `1px solid ${expanded ? 'var(--border-bright)' : 'var(--border)'}`,
          borderBottom: expanded ? 'none' : undefined,
          cursor: 'pointer',
          transition: 'background 0.1s',
        }}
      >
        <span style={{ fontSize: 11, fontFamily: 'monospace', color, flexShrink: 0 }}>
          {frame.status === 'passed' ? '✓' : '✗'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: 16, textAlign: 'right', flexShrink: 0 }}>
          {frame.order}
        </span>
        <MethodBadge method={frame.request?.method} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {frame.name}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', flexShrink: 0, color: statusCodeColor(frame.response?.statusCode) }}>
          {frame.status === 'error' && !frame.response?.statusCode ? 'ERR' : (frame.response?.statusCode || '—')}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0, minWidth: 52, textAlign: 'right' }}>
          {frame.durationMs}ms
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 2 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      {expanded && <FrameDetail frame={frame} />}
    </Fragment>
  )
}
