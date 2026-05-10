import { useState, useEffect, useCallback, Fragment } from 'react'
import { Plus, RefreshCw, MoreHorizontal, Trash2, ToggleLeft, ToggleRight, Save, Layers, Play, Settings } from 'lucide-react'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import Badge from '../components/Badge'
import { FrameResultRow, FrameDetail } from '../components/FrameDetail'

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimeout(ms) {
  if (!ms) return '—'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

// ── Frequency helpers ─────────────────────────────────────────────────────────

const THRESHOLD_OPTIONS = [
  { label: 'All runners',  value: 1.0, hint: 'Every active runner must pass' },
  { label: 'Majority',     value: 0.5, hint: '50% or more must pass' },
  { label: 'Any runner',   value: 0.0, hint: 'At least one runner must pass' },
]

function thresholdLabel(t) {
  if (t == null || t >= 1.0) return 'All runners must pass'
  if (t >= 0.5) return '≥50% of runners must pass'
  return 'At least 1 runner must pass'
}

const FREQUENCY_OPTIONS = [
  { label: '1 minute',   value: 1    },
  { label: '5 minutes',  value: 5    },
  { label: '10 minutes', value: 10   },
  { label: '15 minutes', value: 15   },
  { label: '30 minutes', value: 30   },
  { label: '1 hour',     value: 60   },
  { label: '3 hours',    value: 180  },
  { label: '6 hours',    value: 360  },
  { label: '12 hours',   value: 720  },
  { label: '24 hours',   value: 1440 },
]

function buildCronSchedule(frequencyMinutes, createdAt = new Date()) {
  const now = new Date(createdAt)
  const minute = now.getMinutes()
  const hour = now.getHours()

  if (frequencyMinutes === 1) return '* * * * *'

  if (frequencyMinutes < 60) {
    const anchor = minute % frequencyMinutes
    return `${anchor}/${frequencyMinutes} * * * *`
  }

  if (frequencyMinutes === 60) {
    return `${minute} * * * *`
  }

  if (frequencyMinutes === 1440) {
    return `${minute} ${hour} * * *`
  }

  // 3h, 6h, 12h — anchor to creation hour so firing pattern is consistent
  const hourFreq = Math.floor(frequencyMinutes / 60)
  const anchorHour = hour % hourFreq
  return `${minute} ${anchorHour}/${hourFreq} * * *`
}

function detectFrequency(cron) {
  if (!cron) return 5
  const trimmed = cron.trim()
  if (trimmed === '* * * * *') return 1

  const parts = trimmed.split(' ')
  const minPart = parts[0]
  const hourPart = parts[1]

  // Sub-hour: "anchor/freq * * * *"
  if (minPart.includes('/') && hourPart === '*') {
    return parseInt(minPart.split('/')[1])
  }

  // Hourly: "minute * * * *"
  if (!minPart.includes('/') && hourPart === '*') {
    return 60
  }

  // Multi-hour: "minute anchor/hourFreq * * *"
  if (hourPart && hourPart.includes('/')) {
    return parseInt(hourPart.split('/')[1]) * 60
  }

  // Daily: "minute hour * * *"
  return 1440
}

// ── Path transform helpers (res.body. ↔ $.) ────────────────────────────────────

function toApiPath(displayPath) {
  if (!displayPath) return ''
  if (displayPath.startsWith('res.body.')) return '$.' + displayPath.slice(9)
  if (displayPath === 'res.body') return '$'
  return displayPath
}

function toDisplayPath(apiPath) {
  if (!apiPath) return ''
  if (apiPath.startsWith('$.')) return 'res.body.' + apiPath.slice(2)
  if (apiPath === '$') return 'res.body'
  return apiPath
}

function frameToFormValues(frame) {
  return {
    name: frame.name || '',
    method: frame.request?.method || 'GET',
    url: frame.request?.url || '',
    body: frame.request?.body || '',
    timeout: frame.request?.timeout ? Math.floor(frame.request.timeout / 1000) : 30,
    extractors: (frame.extractors || []).map(ex => ({
      ...ex,
      source: ex.type === 'json' ? toDisplayPath(ex.source) : ex.source,
    })),
    assertions: (frame.assertions || []).map(as => ({
      ...as,
      source: as.type === 'status' ? '' : (as.type === 'json' ? toDisplayPath(as.source) : as.source),
    })),
  }
}

// ── AddRow ────────────────────────────────────────────────────────────────────

function AddRow({ colSpan, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: 'pointer' }}
    >
      <td
        colSpan={colSpan}
        style={{
          textAlign: 'center',
          padding: '11px 16px',
          color: hover ? '#60e8ff' : 'var(--blue)',
          background: hover ? 'var(--blue-dim)' : 'transparent',
          borderBottom: `1px dashed ${hover ? 'var(--blue)' : 'rgba(0,200,240,0.35)'}`,
          transition: 'color 0.12s, background 0.12s, border-color 0.12s',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={13} />
          New Scene
        </div>
      </td>
    </tr>
  )
}

// ── ActionsMenu ───────────────────────────────────────────────────────────────

function ActionsMenu({ scene, onToggle, onDelete }) {
  const [pos, setPos] = useState(null)

  function toggle(e) {
    e.stopPropagation()
    if (pos) { setPos(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
  }

  function act(fn) { setPos(null); fn() }

  const menuStyle = {
    position: 'fixed', top: pos?.top, right: pos?.right, zIndex: 200,
    background: 'var(--surface-raised)', border: '1px solid var(--border-bright)',
    borderRadius: 10, padding: 4, minWidth: 160,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  }

  const itemStyle = (color = 'var(--text)') => ({
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '7px 10px', background: 'none', border: 'none',
    color, fontSize: 13, borderRadius: 6, cursor: 'pointer',
  })

  return (
    <>
      <button className="btn btn--ghost btn--icon" onClick={toggle} title="Actions">
        <MoreHorizontal size={15} />
      </button>
      {pos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setPos(null)} />
          <div style={menuStyle}>
            <button
              style={itemStyle()}
              onClick={() => act(onToggle)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {scene.enabled ? <><ToggleRight size={13} />Disable</> : <><ToggleLeft size={13} />Enable</>}
            </button>
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <button
              style={itemStyle('var(--error)')}
              onClick={() => act(onDelete)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--error-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <Trash2 size={13} />Delete
            </button>
          </div>
        </>
      )}
    </>
  )
}

// ── HTTP method badge colors ──────────────────────────────────────────────────

const METHOD_COLORS = {
  GET:    { bg: 'rgba(0,200,120,0.12)',  color: '#00c878' },
  POST:   { bg: 'rgba(0,160,240,0.12)',  color: '#00a0f0' },
  PUT:    { bg: 'rgba(240,180,0,0.12)',  color: '#f0b400' },
  PATCH:  { bg: 'rgba(180,80,240,0.12)', color: '#b450f0' },
  DELETE: { bg: 'rgba(240,60,60,0.12)',  color: '#f03c3c' },
}

function MethodBadge({ method }) {
  const c = METHOD_COLORS[method] || { bg: 'rgba(120,120,120,0.12)', color: 'var(--text-muted)' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 5,
      fontSize: 10, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.06em',
      background: c.bg, color: c.color,
    }}>
      {method}
    </span>
  )
}

// ── FramesSection ─────────────────────────────────────────────────────────────

const BLANK_EXTRACTOR = { name: '', type: 'json', source: '', dataType: 'string' }
const BLANK_ASSERTION = { type: 'status', operator: 'eq', expected: '200', source: '' }
const BLANK_FRAME = { name: '', method: 'GET', url: '', body: '', timeout: 30, extractors: [], assertions: [] }

const SUBSECTION_LABEL = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'monospace',
}
const INPUT_SM = { padding: '5px 8px', fontSize: 12, height: 30 }
const FIELD_LABEL = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'monospace',
  display: 'block', marginBottom: 3,
}

function FrameFormBuilder({ value, onChange }) {
  function upd(key, val) { onChange({ ...value, [key]: val }) }

  function addExtractor() { onChange({ ...value, extractors: [...value.extractors, { ...BLANK_EXTRACTOR }] }) }
  function removeExtractor(i) { onChange({ ...value, extractors: value.extractors.filter((_, j) => j !== i) }) }
  function updExtractor(i, key, val) {
    const ex = [...value.extractors]; ex[i] = { ...ex[i], [key]: val }; onChange({ ...value, extractors: ex })
  }

  function addAssertion() { onChange({ ...value, assertions: [...value.assertions, { ...BLANK_ASSERTION }] }) }
  function removeAssertion(i) { onChange({ ...value, assertions: value.assertions.filter((_, j) => j !== i) }) }
  function updAssertion(i, key, val) {
    const as = [...value.assertions]; as[i] = { ...as[i], [key]: val }; onChange({ ...value, assertions: as })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Method + URL */}
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 6 }}>
        <div>
          <label style={FIELD_LABEL}>Method</label>
          <select className="form-select" style={INPUT_SM} value={value.method} onChange={e => upd('method', e.target.value)}>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={FIELD_LABEL}>URL *</label>
          <input className="form-input" style={INPUT_SM} placeholder="https://api.example.com/endpoint" value={value.url} onChange={e => upd('url', e.target.value)} required />
        </div>
      </div>

      {/* Name + Timeout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 6 }}>
        <div>
          <label style={FIELD_LABEL}>Name *</label>
          <input className="form-input" style={INPUT_SM} value={value.name} onChange={e => upd('name', e.target.value)} autoFocus required />
        </div>
        <div>
          <label style={FIELD_LABEL}>Timeout (s)</label>
          <input className="form-input" style={INPUT_SM} type="number" min={1} value={value.timeout} onChange={e => upd('timeout', e.target.value)} />
        </div>
      </div>

      {['POST', 'PUT', 'PATCH'].includes(value.method) && (
        <div>
          <label style={FIELD_LABEL}>Request Body</label>
          <textarea className="form-input" style={{ fontSize: 12, resize: 'vertical', minHeight: 52, fontFamily: 'monospace' }} placeholder='{"key": "value"}' value={value.body} onChange={e => upd('body', e.target.value)} />
        </div>
      )}

      {/* Extractors */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={SUBSECTION_LABEL}>Extractors{value.extractors.length > 0 ? ` (${value.extractors.length})` : ''}</span>
          <button type="button" className="btn btn--ghost btn--sm" style={{ fontSize: 11, gap: 4, padding: '2px 8px' }} onClick={addExtractor}>
            <Plus size={11} />Add
          </button>
        </div>
        {value.extractors.length === 0
          ? <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No extractors — variables will not be saved from this frame.</p>
          : <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 75px 1fr 85px 26px', gap: 4, marginBottom: 4 }}>
                {['Variable', 'Type', 'Source', 'Data Type', ''].map((h, i) => (
                  <span key={i} style={{ ...FIELD_LABEL, marginBottom: 0 }}>{h}</span>
                ))}
              </div>
              {value.extractors.map((ex, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 75px 1fr 85px 26px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                  <input className="form-input" style={INPUT_SM} placeholder="token" value={ex.name} onChange={e => updExtractor(i, 'name', e.target.value)} required />
                  <select className="form-select" style={INPUT_SM} value={ex.type} onChange={e => updExtractor(i, 'type', e.target.value)}>
                    <option value="json">json</option>
                    <option value="header">header</option>
                  </select>
                  <input className="form-input" style={INPUT_SM} placeholder={ex.type === 'json' ? 'res.body.data.id' : 'Content-Type'} value={ex.source} onChange={e => updExtractor(i, 'source', e.target.value)} required />
                  <select className="form-select" style={INPUT_SM} value={ex.dataType} onChange={e => updExtractor(i, 'dataType', e.target.value)}>
                    {['string', 'number', 'boolean', 'null'].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <button type="button" className="btn btn--ghost btn--icon" style={{ color: 'var(--error)', width: 26, height: 26 }} onClick={() => removeExtractor(i)}><Trash2 size={12} /></button>
                </div>
              ))}
            </>
        }
      </div>

      {/* Assertions */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={SUBSECTION_LABEL}>Assertions{value.assertions.length > 0 ? ` (${value.assertions.length})` : ''}</span>
          <button type="button" className="btn btn--ghost btn--sm" style={{ fontSize: 11, gap: 4, padding: '2px 8px' }} onClick={addAssertion}>
            <Plus size={11} />Add
          </button>
        </div>
        {value.assertions.length === 0
          ? <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No assertions — response will not be validated.</p>
          : <>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 90px 1fr 1fr 26px', gap: 4, marginBottom: 4 }}>
                {['Type', 'Operator', 'Expected', 'Source', ''].map((h, i) => (
                  <span key={i} style={{ ...FIELD_LABEL, marginBottom: 0 }}>{h}</span>
                ))}
              </div>
              {value.assertions.map((as, i) => {
                const allOps = [
                  { value: 'eq',       label: '=' },
                  { value: 'ne',       label: '≠' },
                  { value: 'gt',       label: '>' },
                  { value: 'gte',      label: '≥' },
                  { value: 'lt',       label: '<' },
                  { value: 'lte',      label: '≤' },
                  { value: 'contains', label: 'contains' },
                ]
                const ops = as.type === 'status' ? allOps.filter(o => o.value !== 'contains') : allOps
                const expectedPlaceholder = as.type === 'status' ? '200' : as.type === 'header' ? 'text value' : 'value'
                const sourcePlaceholder = as.type === 'json' ? 'res.body.field' : 'Header-Name'
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 90px 1fr 1fr 26px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                    <select className="form-select" style={INPUT_SM} value={as.type} onChange={e => {
                      const newType = e.target.value
                      const updated = [...value.assertions]
                      updated[i] = { ...updated[i], type: newType, expected: '', source: '' }
                      onChange({ ...value, assertions: updated })
                    }}>
                      <option value="status">status</option>
                      <option value="json">json</option>
                      <option value="header">header</option>
                    </select>
                    <select className="form-select" style={INPUT_SM} value={as.operator} onChange={e => updAssertion(i, 'operator', e.target.value)}>
                      {ops.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                    <input className="form-input" style={INPUT_SM} placeholder={expectedPlaceholder} value={as.expected} onChange={e => updAssertion(i, 'expected', e.target.value)} />
                    {as.type !== 'status'
                      ? <input className="form-input" style={INPUT_SM} placeholder={sourcePlaceholder} value={as.source} onChange={e => updAssertion(i, 'source', e.target.value)} />
                      : <div />
                    }
                    <button type="button" className="btn btn--ghost btn--icon" style={{ color: 'var(--error)', width: 26, height: 26 }} onClick={() => removeAssertion(i)}><Trash2 size={12} /></button>
                  </div>
                )
              })}
            </>
        }
      </div>
    </div>
  )
}

// ── Results helpers ───────────────────────────────────────────────────────────

function statusColor(status) {
  if (status === 'passed') return 'var(--success)'
  if (status === 'error') return 'var(--peach)'
  return 'var(--error)'
}

function formatTimestamp(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'just now'
  const isToday = new Date().toDateString() === date.toDateString()
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const absolute = isToday
    ? timeStr
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + timeStr
  if (diff >= 7 * 86_400_000) return absolute
  const relative = diff < 3_600_000
    ? `${Math.floor(diff / 60_000)}m ago`
    : diff < 86_400_000
    ? `${Math.floor(diff / 3_600_000)}h ago`
    : `${Math.floor(diff / 86_400_000)}d ago`
  return `${absolute} (${relative})`
}

// ── RunDots ───────────────────────────────────────────────────────────────────

function RunDots({ runs, selectedIdx, onSelect }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {runs.map((run, i) => {
        const selected = i === selectedIdx
        const color = statusColor(run.status)
        return (
          <div
            key={run.runId || i}
            onClick={() => onSelect(i)}
            title={`${run.status} · ${formatTimestamp(run.completedAt)} · ${run.durationMs}ms`}
            style={{
              width: 9, height: 9, borderRadius: '50%',
              background: color,
              cursor: 'pointer',
              flexShrink: 0,
              opacity: selected ? 1 : 0.35,
              boxShadow: selected ? `0 0 0 2px var(--surface-raised), 0 0 0 3.5px ${color}` : 'none',
              transition: 'opacity 0.12s, box-shadow 0.12s',
            }}
          />
        )
      })}
    </div>
  )
}


// ── ResultsSection ────────────────────────────────────────────────────────────

function RunDetailInline({ runId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [runnerIdx, setRunnerIdx] = useState(0)
  const [expandedFrame, setExpandedFrame] = useState(null)

  useEffect(() => {
    setLoading(true)
    setRunnerIdx(0)
    setExpandedFrame(null)
    api.get(`/results/run/${runId}`)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [runId])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
      <div className="spinner" style={{ width: 14, height: 14 }} />
    </div>
  )
  if (!data) return (
    <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No data available.</p>
  )

  const runners = data.runners || []
  const safeIdx = Math.min(runnerIdx, runners.length - 1)
  const runner = runners[safeIdx]

  return (
    <div>
      {/* Aggregate bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 10px', borderRadius: 7, marginBottom: 8,
        background: 'var(--surface-hover)', border: '1px solid var(--border-bright)',
        fontSize: 11, fontFamily: 'monospace',
      }}>
        <span style={{ color: statusColor(data.status) }}>●</span>
        <span style={{ flex: 1, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.runId}
        </span>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {data.passedRunners}/{data.expectedRunners} runners
        </span>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{formatTimestamp(data.completedAt)}</span>
        <span style={{ fontWeight: 700, color: statusColor(data.status), flexShrink: 0 }}>{data.status}</span>
      </div>

      {/* Runner picker */}
      {runners.length > 0 && (
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 8 }}>
          {runners.map((r, i) => (
            <button
              key={r.runnerId}
              onClick={() => { setRunnerIdx(i); setExpandedFrame(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                padding: '3px 9px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                fontWeight: i === safeIdx ? 600 : 400,
                border: '1px solid',
                borderColor: i === safeIdx ? statusColor(r.status) : 'var(--border)',
                background: i === safeIdx ? 'var(--surface-raised)' : 'transparent',
                color: 'var(--text)',
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: statusColor(r.status) }} />
              {r.runnerName}
            </button>
          ))}
        </div>
      )}

      {/* Frames */}
      {runner ? (
        runner.frames?.length > 0 ? (
          runner.frames.map((frame, i) => (
            <FrameResultRow
              key={frame.frameId || i}
              frame={frame}
              expanded={expandedFrame === i}
              onToggle={() => setExpandedFrame(p => p === i ? null : i)}
            />
          ))
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No frame data recorded for this runner.
          </p>
        )
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No runners reported yet.</p>
      )}
    </div>
  )
}

function ResultsSection({ sceneId, toast }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    api.get(`/results/scene/${sceneId}/summary`)
      .then(data => setSummary(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sceneId]) // eslint-disable-line

  const metaLabel = { fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }
  const metaValue = (color = 'var(--text-dim)') => ({ fontSize: 11, fontFamily: 'monospace', color })

  const hasRuns = summary?.recentRuns?.length > 0
  const selectedRun = hasRuns ? summary.recentRuns[selectedIdx] : null

  function selectRun(i) {
    setSelectedIdx(i)
  }

  return (
    <div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <div className="spinner" style={{ width: 16, height: 16 }} />
        </div>
      ) : !hasRuns ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px', fontStyle: 'italic' }}>
          No results yet — this scene hasn&apos;t been executed.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <RunDots runs={summary.recentRuns} selectedIdx={selectedIdx} onSelect={selectRun} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={metaLabel}>last pass</span>
                <span style={metaValue(summary.lastPass ? 'var(--success)' : 'var(--text-muted)')}>
                  {summary.lastPass ? formatTimestamp(summary.lastPass.completedAt) : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={metaLabel}>last fail</span>
                <span style={metaValue(summary.lastFail ? 'var(--error)' : 'var(--text-muted)')}>
                  {summary.lastFail ? formatTimestamp(summary.lastFail.completedAt) : '—'}
                </span>
              </div>
            </div>
          </div>
          {selectedRun && (
            <RunDetailInline runId={selectedRun.runId} />
          )}
        </>
      )}
    </div>
  )
}

function FramesSection({ sceneId, toast, staged, setStaged, onFramesChanged, collapsible = true }) {
  const [open, setOpen] = useState(true)
  const [frames, setFrames] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FRAME, extractors: [], assertions: [] })
  const [deletingId, setDeletingId] = useState(null)
  const [committing, setCommitting] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedForm, setExpandedForm] = useState(null)
  const [savingFrame, setSavingFrame] = useState(false)
  const [expandedTestResult, setExpandedTestResult] = useState(null)
  const [expandedTesting, setExpandedTesting] = useState(false)
  const [formTestResult, setFormTestResult] = useState(null)
  const [formTesting, setFormTesting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api.get(`/scenes/${sceneId}/frames`)
      .then(data => setFrames(data.frames || []))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [sceneId, open]) // eslint-disable-line

  // Unified list for drag-and-drop: committed first, staged after
  const allItems = [
    ...frames.map(f => ({ ...f, _it: 'c' })),
    ...staged.map(f => ({ ...f, _it: 's' })),
  ]

  function handleDragStart(e, idx) {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIdx !== idx) setDragOverIdx(idx)
  }

  function handleDrop(e, toIdx) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOverIdx(null); return }

    const newAll = [...allItems]
    const [moved] = newAll.splice(dragIdx, 1)
    newAll.splice(toIdx, 0, moved)

    const newCommitted = newAll.filter(f => f._it === 'c').map(({ _it, ...f }) => f)
    const newStaged = newAll.filter(f => f._it === 's').map(({ _it, ...f }) => f)

    const orderChanged = newCommitted.some((f, i) => f._id !== frames[i]?._id)
    setFrames(newCommitted)
    setStaged(newStaged)

    if (orderChanged && newCommitted.length > 0) {
      api.put(`/scenes/${sceneId}/frames/reorder`, { frameIds: newCommitted.map(f => f._id) })
        .catch(err => toast.error('Failed to save order: ' + err.message))
    }

    setDragIdx(null)
    setDragOverIdx(null)
  }

  function transformForApi(frame) {
    return {
      extractors: (frame.extractors || []).map(ex => ({
        ...ex,
        source: ex.type === 'json' ? toApiPath(ex.source) : ex.source,
      })),
      assertions: (frame.assertions || []).map(as => ({
        ...as,
        source: as.type === 'status' ? 'status' : (as.type === 'json' ? toApiPath(as.source) : as.source),
      })),
    }
  }

  async function runTest(formValues, setTesting, setResult) {
    setTesting(true)
    setResult(null)
    try {
      const { assertions } = transformForApi({ assertions: formValues.assertions })
      const res = await api.post('/frames/test', {
        request: {
          method: formValues.method,
          url: formValues.url.trim(),
          body: formValues.body?.trim() || '',
          timeout: Math.floor(Number(formValues.timeout) * 1000),
        },
        assertions,
      })
      setResult(res.frame)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setTesting(false)
    }
  }

  function toggleExpand(frame) {
    if (expandedId === frame._id) {
      setExpandedId(null)
      setExpandedForm(null)
      setExpandedTestResult(null)
    } else {
      setExpandedId(frame._id)
      setExpandedForm(frameToFormValues(frame))
      setExpandedTestResult(null)
    }
  }

  async function handleFrameUpdate(frame) {
    setSavingFrame(true)
    try {
      const { extractors, assertions } = transformForApi({ extractors: expandedForm.extractors, assertions: expandedForm.assertions })
      const result = await api.put(`/scenes/${sceneId}/frames/${frame._id}`, {
        name: expandedForm.name.trim(),
        request: {
          method: expandedForm.method,
          url: expandedForm.url.trim(),
          body: expandedForm.body.trim(),
          timeout: Math.floor(Number(expandedForm.timeout) * 1000),
        },
        extractors,
        assertions,
      })
      setFrames(prev => prev.map(f => f._id === frame._id ? result.frame : f))
      setExpandedId(null)
      setExpandedForm(null)
      toast.success(`Frame "${result.frame.name}" updated`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingFrame(false)
    }
  }

  function stageFrame() {
    if (!form.name.trim() || !form.url.trim()) return
    setStaged(s => [...s, { ...form, _sid: Date.now() }])
    setForm({ ...BLANK_FRAME, extractors: [], assertions: [] })
    setShowForm(false)
  }

  async function commitAll() {
    setCommitting(true)
    const added = []
    for (const f of staged) {
      try {
        const { extractors, assertions } = transformForApi(f)
        const result = await api.post(`/scenes/${sceneId}/frames`, {
          name: f.name.trim(),
          request: { method: f.method, url: f.url.trim(), body: f.body.trim(), timeout: Math.floor(Number(f.timeout) * 1000) },
          extractors,
          assertions,
        })
        added.push(result.frame)
      } catch (err) {
        toast.error(`Failed to save "${f.name}": ${err.message}`)
      }
    }
    setFrames(prev => [...prev, ...added])
    setStaged([])
    if (added.length > 0) {
      toast.success(`${added.length} frame${added.length !== 1 ? 's' : ''} saved`)
      onFramesChanged?.()
    }
    setCommitting(false)
  }

  async function handleDelete(frame) {
    setDeletingId(frame._id)
    try {
      await api.delete(`/scenes/${sceneId}/frames/${frame._id}`)
      setFrames(f => f.filter(fr => fr._id !== frame._id))
      toast.success(`Frame "${frame.name}" deleted`)
      onFramesChanged?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const sectionLabel = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace',
  }

  const isOpen = collapsible ? open : true

  return (
    <div style={collapsible ? { borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 16 } : {}}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isOpen ? 10 : 0 }}>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Layers size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={sectionLabel}>Frames</span>
            {frames.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                ({frames.length}{staged.length > 0 ? ` + ${staged.length} pending` : ''})
              </span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>{open ? '▲' : '▼'}</span>
          </button>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {frames.length > 0 ? `${frames.length} frame${frames.length !== 1 ? 's' : ''}${staged.length > 0 ? ` · ${staged.length} pending` : ''}` : ''}
          </span>
        )}
        {isOpen && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {staged.length > 0 && (
              <button className="btn btn--primary btn--sm" onClick={committing ? undefined : commitAll} disabled={committing} style={{ fontSize: 11, gap: 4 }}>
                {committing
                  ? <><div className="spinner" style={{ width: 11, height: 11 }} />Saving…</>
                  : <><Save size={11} />Save {staged.length} Frame{staged.length !== 1 ? 's' : ''}</>
                }
              </button>
            )}
            {!showForm && (
              <button className="btn btn--ghost btn--sm" style={{ fontSize: 11, gap: 4 }} onClick={() => setShowForm(true)}>
                <Plus size={12} />Add Frame
              </button>
            )}
          </div>
        )}
      </div>

      {!isOpen ? null : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <div className="spinner" style={{ width: 16, height: 16 }} />
        </div>
      ) : (
        <>
          {allItems.length === 0 && !showForm && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px', fontStyle: 'italic' }}>
              No frames yet. Add one to define the HTTP requests this scene will run.
            </p>
          )}

          {allItems.map((frame, idx) => {
            const isPending = frame._it === 's'
            const method = isPending ? frame.method : frame.request?.method
            const url = isPending ? frame.url : frame.request?.url
            const extCount = frame.extractors?.length || 0
            const assertCount = frame.assertions?.length || 0
            const isDragging = dragIdx === idx
            const isDragOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx
            const isExpanded = !isPending && expandedId === frame._id
            const key = isPending ? frame._sid : frame._id

            return (
              <Fragment key={key}>
                <div
                  draggable
                  onDragStart={e => handleDragStart(e, idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={e => handleDrop(e, idx)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                  onClick={() => { if (!isPending) toggleExpand(frame) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                    marginBottom: isExpanded ? 0 : 4,
                    background: isExpanded ? 'var(--surface-hover)' : isPending ? 'rgba(0,200,240,0.04)' : 'var(--surface-raised)',
                    border: `1px ${isPending ? 'dashed' : 'solid'} ${isDragOver ? 'var(--blue)' : isExpanded ? 'var(--blue)' : isPending ? 'rgba(0,200,240,0.5)' : 'var(--border)'}`,
                    borderBottom: isExpanded ? 'none' : undefined,
                    opacity: isDragging ? 0.35 : 1,
                    cursor: isPending ? 'grab' : 'pointer',
                    boxShadow: isDragOver ? '0 0 0 1px var(--blue)' : 'none',
                    transition: 'opacity 0.1s, box-shadow 0.1s',
                  }}
                >
                  <span
                    style={{ color: 'var(--border-bright)', fontSize: 14, userSelect: 'none', lineHeight: 1, cursor: 'grab' }}
                    onMouseDown={e => e.stopPropagation()}
                  >⠿</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: isPending ? 'var(--blue)' : 'var(--text-muted)', minWidth: 18, textAlign: 'right' }}>
                    {idx + 1}
                  </span>
                  <MethodBadge method={method} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {frame.name}
                      {isPending && <span style={{ fontSize: 10, color: 'var(--blue)', fontFamily: 'monospace', fontWeight: 400 }}>pending</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {url}
                    </div>
                  </div>
                  {(extCount > 0 || assertCount > 0) && (
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {extCount > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{extCount} extractor{extCount !== 1 ? 's' : ''}</span>}
                      {assertCount > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{assertCount} assertion{assertCount !== 1 ? 's' : ''}</span>}
                    </div>
                  )}
                  <button
                    className="btn btn--ghost btn--icon"
                    style={{ color: isPending ? 'var(--text-muted)' : 'var(--error)', opacity: deletingId === frame._id ? 0.5 : 1, cursor: 'pointer' }}
                    disabled={!isPending && deletingId === frame._id}
                    onClick={e => {
                      e.stopPropagation()
                      isPending ? setStaged(s => s.filter(f => f._sid !== frame._sid)) : handleDelete(frame)
                    }}
                    title={isPending ? 'Remove' : 'Delete frame'}
                  >
                    {!isPending && deletingId === frame._id
                      ? <div className="spinner" style={{ width: 12, height: 12 }} />
                      : <Trash2 size={13} />
                    }
                  </button>
                </div>

                {isExpanded && expandedForm && (
                  <div style={{
                    padding: 14, marginBottom: 4,
                    border: '1px solid var(--blue)', borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    background: 'var(--surface-raised)',
                  }}>
                    <FrameFormBuilder value={expandedForm} onChange={v => { setExpandedForm(v); setExpandedTestResult(null) }} />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 12 }}>
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setExpandedId(null); setExpandedForm(null); setExpandedTestResult(null) }}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={expandedTesting || !expandedForm.url.trim()}
                        onClick={() => runTest(expandedForm, setExpandedTesting, setExpandedTestResult)}
                      >
                        {expandedTesting
                          ? <><div className="spinner" style={{ width: 12, height: 12 }} />Testing…</>
                          : '▶ Test'
                        }
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={savingFrame || !expandedForm.name.trim() || !expandedForm.url.trim()}
                        onClick={() => handleFrameUpdate(frame)}
                      >
                        {savingFrame
                          ? <><div className="spinner" style={{ width: 12, height: 12 }} />Saving…</>
                          : <><Save size={12} />Save Changes</>
                        }
                      </button>
                    </div>
                    {expandedTestResult && (
                      <div style={{ marginTop: 12 }}>
                        <FrameDetail frame={expandedTestResult} />
                      </div>
                    )}
                  </div>
                )}
              </Fragment>
            )
          })}

          {showForm && (
            <div style={{
              padding: 14, borderRadius: 8, border: '1px dashed var(--blue)',
              background: 'rgba(0,200,240,0.04)',
              marginTop: allItems.length > 0 ? 8 : 0,
            }}>
              <FrameFormBuilder value={form} onChange={v => { setForm(v); setFormTestResult(null) }} />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setShowForm(false); setForm({ ...BLANK_FRAME, extractors: [], assertions: [] }); setFormTestResult(null) }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={formTesting || !form.url.trim()}
                  onClick={() => runTest(form, setFormTesting, setFormTestResult)}
                >
                  {formTesting
                    ? <><div className="spinner" style={{ width: 12, height: 12 }} />Testing…</>
                    : '▶ Test'
                  }
                </button>
                <button type="button" className="btn btn--primary btn--sm" disabled={!form.name.trim() || !form.url.trim()} onClick={stageFrame}>
                  <Plus size={12} />Stage Frame
                </button>
              </div>
              {formTestResult && (
                <div style={{ marginTop: 12 }}>
                  <FrameDetail frame={formTestResult} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── SceneModal ────────────────────────────────────────────────────────────────

function SceneModal({ scene, onSave, onClose, saving, toast, onFramesChanged, onRunNow }) {
  const [tab, setTab] = useState('results')
  const [editingConfig, setEditingConfig] = useState(false)
  const [staged, setStaged] = useState([])
  const [closeBlocked, setCloseBlocked] = useState(false)
  const [form, setForm] = useState({
    name:          scene.name || '',
    description:   scene.description || '',
    timeout:       scene.timeout ? Math.round(scene.timeout / 60000) : 5,
    frequency:     detectFrequency(scene.cronSchedule),
    enabled:       scene.enabled ?? true,
    passThreshold: scene.passThreshold ?? 1.0,
  })

  function handleClose() {
    if (staged.length > 0) {
      setCloseBlocked(true)
    } else {
      onClose()
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      name:          form.name.trim(),
      description:   form.description.trim(),
      timeout:       Math.floor(Number(form.timeout) * 60000),
      cronSchedule:  buildCronSchedule(form.frequency),
      enabled:       form.enabled,
      passThreshold: form.passThreshold,
    })
  }

  function cancelEdit() {
    setForm({
      name:          scene.name || '',
      description:   scene.description || '',
      timeout:       scene.timeout ? Math.round(scene.timeout / 60000) : 5,
      frequency:     detectFrequency(scene.cronSchedule),
      enabled:       scene.enabled ?? true,
      passThreshold: scene.passThreshold ?? 1.0,
    })
    setEditingConfig(false)
  }

  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    fontFamily: 'monospace', display: 'block', marginBottom: 6,
  }

  const freqLabel = FREQUENCY_OPTIONS.find(o => o.value === detectFrequency(scene.cronSchedule))?.label ?? scene.cronSchedule

  return (
    <>
      <div className="modal-body" style={{ padding: 0 }}>

        {/* Scene info bar */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Badge variant={scene.enabled ? 'active' : 'disabled'}>{scene.enabled ? 'Enabled' : 'Disabled'}</Badge>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>every {freqLabel}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{thresholdLabel(scene.passThreshold)}</span>
          {scene.description && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {scene.description}</span>
          )}
          {onRunNow && (
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginLeft: 'auto', gap: 5, fontSize: 11 }}
              onClick={onRunNow}
            >
              <Play size={11} />Run Now
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {[['results', 'Results'], ['frames', 'Configure'], ['config', 'Settings']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                padding: '9px 18px', fontSize: 12,
                fontWeight: tab === id ? 600 : 400,
                color: tab === id ? 'var(--text)' : 'var(--text-muted)',
                background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === id ? 'var(--blue)' : 'transparent'}`,
                cursor: 'pointer', marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ height: 440, overflowY: 'auto' }}>

        {/* Results tab */}
        {tab === 'results' && (
          <div style={{ padding: '16px 20px' }}>
            <ResultsSection sceneId={scene.id} toast={toast} />
          </div>
        )}

        {/* Frames tab */}
        {tab === 'frames' && (
          <div style={{ padding: '16px 20px' }}>
            <FramesSection
              sceneId={scene.id}
              toast={toast}
              staged={staged}
              setStaged={setStaged}
              onFramesChanged={onFramesChanged}
              collapsible={false}
            />
          </div>
        )}

        {/* Settings tab */}
        {tab === 'config' && (
        <div style={{ padding: '16px 20px' }}>

        {/* ── Scene details ────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          {editingConfig ? (
            <form id="scene-details-form" onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                <div>
                  <label style={labelStyle}>Name *</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Timeout (minutes)</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={1440}
                    value={form.timeout}
                    onChange={e => setForm(f => ({ ...f, timeout: e.target.value }))}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    className="form-input"
                    placeholder="What does this scene test?"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Frequency</label>
                  <select
                    className="form-select"
                    value={form.frequency}
                    onChange={e => setForm(f => ({ ...f, frequency: Number(e.target.value) }))}
                    style={{ width: '100%' }}
                  >
                    {FREQUENCY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[true, false].map(val => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, enabled: val }))}
                        style={{
                          flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 700,
                          borderRadius: 6, cursor: 'pointer', border: '1px solid',
                          fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase',
                          transition: 'all 0.12s',
                          background: form.enabled === val ? (val ? 'var(--success-bg)' : 'var(--error-bg)') : 'transparent',
                          borderColor: form.enabled === val ? (val ? 'var(--success)' : 'var(--error)') : 'var(--border)',
                          color: form.enabled === val ? (val ? 'var(--success)' : 'var(--error)') : 'var(--text-muted)',
                        }}
                      >
                        {val ? 'Enabled' : 'Disabled'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Pass Threshold</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {THRESHOLD_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        title={opt.hint}
                        onClick={() => setForm(f => ({ ...f, passThreshold: opt.value }))}
                        style={{
                          flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 700,
                          borderRadius: 6, cursor: 'pointer', border: '1px solid',
                          fontFamily: 'monospace', transition: 'all 0.12s',
                          background: form.passThreshold === opt.value ? 'rgba(0,160,240,0.12)' : 'transparent',
                          borderColor: form.passThreshold === opt.value ? 'var(--blue)' : 'var(--border)',
                          color: form.passThreshold === opt.value ? '#60e8ff' : 'var(--text-muted)',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <>
              <button
                type="button"
                title="Edit scene settings"
                onClick={() => setEditingConfig(true)}
                style={{
                  position: 'absolute', top: 0, right: 0,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 4, borderRadius: 6,
                  display: 'flex', alignItems: 'center', transition: 'color 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <Settings size={14} />
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', paddingRight: 28 }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <div style={{ fontSize: 13, color: 'var(--text)', paddingTop: 2 }}>{scene.name}</div>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <div style={{ fontSize: 13, paddingTop: 2 }}>
                    <Badge variant={scene.enabled ? 'active' : 'disabled'}>{scene.enabled ? 'Enabled' : 'Disabled'}</Badge>
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Description</label>
                  <div style={{ fontSize: 13, color: 'var(--text)', paddingTop: 2 }}>
                    {scene.description || <span style={{ color: 'var(--text-muted)' }}>No description</span>}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Frequency</label>
                  <div style={{ fontSize: 13, color: 'var(--text)', paddingTop: 2 }}>{freqLabel}</div>
                </div>
                <div>
                  <label style={labelStyle}>Timeout</label>
                  <div style={{ fontSize: 13, color: 'var(--text)', paddingTop: 2 }}>{formatTimeout(scene.timeout)}</div>
                </div>
                <div>
                  <label style={labelStyle}>Created</label>
                  <div style={{ fontSize: 13, color: 'var(--text)', paddingTop: 2 }}>{formatDate(scene.createdAt)}</div>
                </div>
                <div>
                  <label style={labelStyle}>Pass Threshold</label>
                  <div style={{ fontSize: 13, color: 'var(--text)', paddingTop: 2 }}>{thresholdLabel(scene.passThreshold)}</div>
                </div>
              </div>
            </>
          )}
        </div>

        </div>
        )}

        </div>
      </div>

      <div className="modal-footer">
        {closeBlocked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--warning, #f0b400)' }}>
              {staged.length} unsaved frame{staged.length !== 1 ? 's' : ''} will be lost — discard and close?
            </span>
            <button className="btn btn--secondary btn--sm" onClick={() => setCloseBlocked(false)}>Go Back</button>
            <button className="btn btn--danger btn--sm" onClick={() => { setStaged([]); onClose() }}>Discard &amp; Close</button>
          </div>
        ) : tab === 'config' && editingConfig ? (
          <>
            <button type="button" className="btn btn--secondary" onClick={cancelEdit}>Cancel</button>
            <button
              type="submit"
              form="scene-details-form"
              className="btn btn--primary"
              disabled={saving || !form.name.trim()}
            >
              {saving
                ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving…</>
                : <><Save size={14} /> Save Changes</>
              }
            </button>
          </>
        ) : (
          <button className="btn btn--secondary" onClick={handleClose}>Close</button>
        )}
      </div>
    </>
  )
}

// ── CreateForm ────────────────────────────────────────────────────────────────

function CreateForm({ onSubmit, onClose, submitting }) {
  const [form, setForm] = useState({ name: '', description: '', timeout: 5, frequency: 5, passThreshold: 1.0 })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit({
      name:          form.name.trim(),
      description:   form.description.trim(),
      timeout:       Math.floor(Number(form.timeout) * 60000),
      cronSchedule:  buildCronSchedule(form.frequency),
      passThreshold: form.passThreshold,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Scene Name <span style={{ color: 'var(--error)' }}>*</span></label>
          <input
            className="form-input"
            placeholder="e.g. Smoke Test Suite"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-input"
            placeholder="What does this scene test?"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Frequency</label>
          <select
            className="form-select"
            value={form.frequency}
            onChange={e => setForm(f => ({ ...f, frequency: Number(e.target.value) }))}
            style={{ width: '100%' }}
          >
            {FREQUENCY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Timeout (minutes)</label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={1440}
            value={form.timeout}
            onChange={e => setForm(f => ({ ...f, timeout: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Pass Threshold</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {THRESHOLD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                title={opt.hint}
                onClick={() => setForm(f => ({ ...f, passThreshold: opt.value }))}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700,
                  borderRadius: 6, cursor: 'pointer', border: '1px solid',
                  fontFamily: 'monospace', transition: 'all 0.12s',
                  background: form.passThreshold === opt.value ? 'rgba(0,160,240,0.12)' : 'transparent',
                  borderColor: form.passThreshold === opt.value ? 'var(--blue)' : 'var(--border)',
                  color: form.passThreshold === opt.value ? '#60e8ff' : 'var(--text-muted)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {THRESHOLD_OPTIONS.find(o => o.value === form.passThreshold)?.hint}
          </p>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={submitting || !form.name.trim()}>
          {submitting
            ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Creating…</>
            : 'Create Scene'
          }
        </button>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Scenes() {
  const toast = useToast()

  const [scenes, setScenes] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [editTarget, setEditTarget] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true)
    api.get(`/scenes?page=${page}&limit=${limit}`)
      .then(data => {
        setScenes(data.data || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      })
      .catch(err => toast.error(err.message))
      .finally(() => { if (showSpinner) setLoading(false) })
  }, [page, limit]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  function handleLimitChange(e) { setLimit(Number(e.target.value)); setPage(1) }

  async function handleCreate(fields) {
    setSubmitting(true)
    try {
      await api.post('/scene', fields)
      toast.success(`Scene "${fields.name}" created`)
      setShowCreate(false)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(fields) {
    setSubmitting(true)
    try {
      await api.put(`/scene/${editTarget.id}`, fields)
      toast.success('Scene updated')
      setEditTarget(null)
      load(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRunNow(scene) {
    try {
      const res = await api.post(`/scenes/${scene.id}/run`, {})
      const runnerWord = res.expectedRunners === 1 ? 'runner' : 'runners'
      toast.success(`Run triggered — dispatched to ${res.expectedRunners} ${runnerWord}`)
      setTimeout(() => load(false), 1500)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleToggle(scene) {
    try {
      await api.put(`/scene/${scene.id}`, { enabled: !scene.enabled })
      toast.success(`Scene ${scene.enabled ? 'disabled' : 'enabled'}`)
      load(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleDelete() {
    setSubmitting(true)
    try {
      await api.delete(`/scene/${deleteTarget.id}`)
      toast.success(`Scene "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Scenes</h1>
          <p className="page-subtitle">
            {total > 0 ? `${total} scene${total !== 1 ? 's' : ''}` : 'Define and manage test scenarios for your runners.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn--secondary btn--sm" onClick={() => load()}>
            <RefreshCw size={14} />Refresh
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} />New Scene
          </button>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner--lg" />
          </div>
        ) : (
          <div className="table-wrap">
            {total > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                background: 'var(--surface-raised)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Per page</label>
                  <select
                    className="form-select"
                    value={limit}
                    onChange={handleLimitChange}
                    style={{ padding: '3px 8px', fontSize: 12, height: 28 }}
                  >
                    {PAGE_SIZE_OPTIONS.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <table className="table">
              <thead>
                <tr>
                  <th>Scene</th>
                  <th>Last Run</th>
                  <th>Schedule</th>
                  <th style={{ width: 88 }}></th>
                </tr>
              </thead>
              <tbody>
                {scenes.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                      No scenes yet. Create one to get started.
                    </td>
                  </tr>
                )}
                {scenes.map(scene => {
                  const statusColor = scene.lastRunStatus === 'passed' ? 'var(--success)' : scene.lastRunStatus === 'error' ? 'var(--peach)' : scene.lastRunStatus ? 'var(--error)' : null
                  const freqLabel = FREQUENCY_OPTIONS.find(o => o.value === detectFrequency(scene.cronSchedule))?.label ?? scene.cronSchedule ?? '—'
                  return (
                    <tr
                      key={scene.id || scene._id}
                      onClick={() => setEditTarget(scene)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {scene.lastRunStatus && (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: statusColor }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 500, color: scene.enabled ? 'var(--text)' : 'var(--text-muted)' }}>
                              {scene.name}
                            </div>
                            {scene.description && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340 }}>
                                {scene.description}
                              </div>
                            )}
                          </div>
                          {!scene.enabled && (
                            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', background: 'var(--surface-hover)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                              disabled
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {scene.lastRunStatus ? (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: statusColor }}>
                              {scene.lastRunStatus}
                            </div>
                            {scene.lastRunAt && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 1 }}>
                                {formatTimestamp(scene.lastRunAt)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>No runs yet</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                          every {freqLabel}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn--ghost btn--icon"
                            title="Run now"
                            onClick={() => handleRunNow(scene)}
                            style={{ color: 'var(--blue)' }}
                          >
                            <Play size={13} />
                          </button>
                          <ActionsMenu
                            scene={scene}
                            onToggle={() => handleToggle(scene)}
                            onDelete={() => setDeleteTarget(scene)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editTarget && (
        <Modal key={editTarget.id} title={editTarget.name} onClose={() => setEditTarget(null)} xl>
          <SceneModal
            scene={editTarget}
            onSave={handleEdit}
            onClose={() => setEditTarget(null)}
            saving={submitting}
            toast={toast}
            onFramesChanged={() => load(false)}
            onRunNow={() => handleRunNow(editTarget)}
          />
        </Modal>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="New Scene" onClose={() => setShowCreate(false)}>
          <CreateForm
            onSubmit={handleCreate}
            onClose={() => setShowCreate(false)}
            submitting={submitting}
          />
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Modal title="Delete Scene" onClose={() => setDeleteTarget(null)}>
          <div className="modal-body">
            <p style={{ color: 'var(--text-dim)', marginBottom: 8 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{deleteTarget.name}</strong>?
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              This will permanently remove the scene. Frames associated with it will need to be cleaned up separately.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn btn--danger" onClick={handleDelete} disabled={submitting}>
              {submitting
                ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Deleting…</>
                : 'Delete Scene'
              }
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
