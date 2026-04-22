import { useState, useEffect, useCallback, Fragment } from 'react'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useAuth } from '../context/AuthContext'
import { FrameResultRow } from '../components/FrameDetail'

const STATUS_FILTERS = ['all', 'passed', 'failed', 'error']

function statusColor(s) {
  if (s === 'passed') return 'var(--success)'
  if (s === 'error')  return 'var(--peach)'
  return 'var(--error)'
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function RunDetail({ runId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedFrame, setExpandedFrame] = useState(null)

  useEffect(() => {
    api.get(`/results/run/${runId}`)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [runId])

  if (loading) return (
    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="spinner" style={{ width: 14, height: 14 }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading frames…</span>
    </div>
  )

  if (!data) return (
    <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
      No frame data available.
    </div>
  )

  const frames = data.frames || []
  const passed = frames.filter(f => f.status === 'passed').length

  return (
    <div style={{ padding: '10px 16px 12px' }}>
      <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 8 }}>
        {passed}/{frames.length} frames passed · {data.durationMs}ms total
      </div>
      {frames.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No frames recorded.</p>
      ) : frames.map((frame, i) => (
        <FrameResultRow
          key={frame.frameId || i}
          frame={frame}
          expanded={expandedFrame === i}
          onToggle={() => setExpandedFrame(p => p === i ? null : i)}
        />
      ))}
    </div>
  )
}

function RunRow({ run }) {
  const [expanded, setExpanded] = useState(false)
  const color = statusColor(run.status)

  const passed = run.status === 'passed'
  const rowBg = expanded
    ? 'var(--surface-hover)'
    : passed ? 'transparent' : 'rgba(240,96,96,0.03)'

  return (
    <Fragment>
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer', background: rowBg }}
      >
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontWeight: 500 }}>{run.sceneName}</span>
          </div>
        </td>
        <td>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
            {run.runId?.slice(0, 20)}…
          </span>
        </td>
        <td>
          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color }}>
            {run.status}
          </span>
        </td>
        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
          {run.durationMs}ms
        </td>
        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {timeAgo(run.completedAt)}
        </td>
        <td style={{ width: 32, textAlign: 'center' }}>
          {expanded
            ? <ChevronUp size={13} style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
          }
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0, background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
            <RunDetail runId={run.runId} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

export default function Runs() {
  const toast = useToast()
  const { heartbeatInterval } = useAuth()
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true)
    api.get('/results/recent?limit=6')
      .then(res => setRuns(res.data || []))
      .catch(err => toast.error(err.message))
      .finally(() => { if (showSpinner) setLoading(false) })
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(false), heartbeatInterval)

  const filtered = statusFilter === 'all' ? runs : runs.filter(r => r.status === statusFilter)

  const counts = {
    all: runs.length,
    passed: runs.filter(r => r.status === 'passed').length,
    failed: runs.filter(r => r.status === 'failed').length,
    error:  runs.filter(r => r.status === 'error').length,
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Runs</h1>
          <p className="page-subtitle">
            {runs.length > 0 ? `${runs.length} recent run${runs.length !== 1 ? 's' : ''}` : 'Recent test execution history.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-raised)', borderRadius: 4, padding: 2, border: '1px solid var(--border)' }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 3,
                  border: 'none', cursor: 'pointer', fontFamily: 'monospace',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  background: statusFilter === f ? 'var(--surface-hover)' : 'transparent',
                  color: statusFilter === f
                    ? (f === 'passed' ? 'var(--success)' : f === 'failed' ? 'var(--error)' : f === 'error' ? 'var(--peach)' : 'var(--text)')
                    : 'var(--text-muted)',
                  transition: 'all 0.1s',
                }}
              >
                {f} {counts[f] > 0 ? <span style={{ opacity: 0.6 }}>({counts[f]})</span> : null}
              </button>
            ))}
          </div>
          <button className="btn btn--secondary btn--sm" onClick={() => load()}>
            <RefreshCw size={13} />Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner--lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>No runs yet</p>
            <p style={{ fontSize: 12 }}>Results will appear here once scenes start executing.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Scene</th>
                  <th>Run ID</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Completed</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(run => (
                  <RunRow key={run.runId} run={run} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
