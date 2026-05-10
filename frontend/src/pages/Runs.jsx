import { useState, useEffect, useCallback, Fragment } from 'react'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../api/client'
import Pagination from '../components/Pagination'
import { useToast } from '../context/ToastContext'
import { FrameResultRow } from '../components/FrameDetail'

const STATUS_FILTERS = ['all', 'passed', 'failed', 'pending', 'error']
const PAGE_LIMIT = 20

function statusColor(s) {
  if (s === 'passed')  return 'var(--success)'
  if (s === 'pending') return 'var(--blue)'
  if (s === 'error')   return 'var(--peach)'
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

function RunnerDetail({ runner }) {
  const [expandedFrame, setExpandedFrame] = useState(null)
  const frames = runner.frames || []
  const passed = frames.filter(f => f.status === 'passed').length

  return (
    <div>
      {/* Runner info bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: statusColor(runner.status) }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{runner.runnerName}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {passed}/{frames.length} frames · {runner.durationMs}ms
        </span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: statusColor(runner.status), marginLeft: 'auto' }}>
          {runner.status}
        </span>
      </div>

      {/* Frames */}
      <div style={{ padding: '10px 16px 12px' }}>
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
    </div>
  )
}

function RunDetail({ runId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [runnerIdx, setRunnerIdx] = useState(0)

  useEffect(() => {
    api.get(`/results/run/${runId}`)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [runId])

  if (loading) return (
    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="spinner" style={{ width: 14, height: 14 }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>
    </div>
  )

  if (!data) return (
    <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
      No data available.
    </div>
  )

  const runners = data.runners || []
  const safeIdx = Math.min(runnerIdx, runners.length - 1)

  return (
    <div>
      {/* Aggregate summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '7px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-raised)',
        fontSize: 11, fontFamily: 'monospace',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {data.passedRunners}/{data.expectedRunners} runners passed
        </span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span style={{ color: 'var(--text-muted)' }}>{data.durationMs}ms total</span>
        {data.isPending && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--blue)' }}>waiting for runners…</span>
          </>
        )}
      </div>

      {runners.length === 0 ? (
        <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No runner results yet.
        </div>
      ) : (
        <>
          {/* Runner picker */}
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 16px',
            borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)',
          }}>
            {runners.map((r, i) => (
              <button
                key={r.runnerId}
                onClick={() => setRunnerIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                  fontWeight: i === safeIdx ? 600 : 400,
                  border: '1px solid',
                  borderColor: i === safeIdx ? statusColor(r.status) : 'var(--border)',
                  background: i === safeIdx ? 'var(--surface)' : 'transparent',
                  color: 'var(--text)',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: statusColor(r.status) }} />
                {r.runnerName}
              </button>
            ))}
          </div>
          <RunnerDetail key={safeIdx} runner={runners[safeIdx]} />
        </>
      )}
    </div>
  )
}

function RunRow({ run }) {
  const [expanded, setExpanded] = useState(false)
  const color = statusColor(run.status)

  const runnersLabel = run.status === 'pending'
    ? `${run.reportedRunners}/${run.expectedRunners} reported`
    : `${run.passedRunners}/${run.expectedRunners} passed`

  return (
    <Fragment>
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{
          cursor: 'pointer',
          background: expanded
            ? 'var(--surface-hover)'
            : run.status === 'failed' || run.status === 'error'
              ? 'rgba(240,96,96,0.03)'
              : 'transparent',
        }}
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
          <span style={{
            fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
            color: run.passedRunners === run.expectedRunners
              ? 'var(--success)'
              : run.status === 'pending' ? 'var(--blue)' : 'var(--error)',
          }}>
            {runnersLabel}
          </span>
        </td>
        <td>
          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color }}>
            {run.status}
          </span>
        </td>
        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
          {run.durationMs != null ? `${run.durationMs}ms` : '—'}
        </td>
        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {formatTimestamp(run.completedAt)}
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
          <td colSpan={7} style={{ padding: 0, background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
            <RunDetail runId={run.runId} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

export default function Runs() {
  const toast = useToast()
  const [runs, setRuns] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sceneSearch, setSceneSearch] = useState('')

  const load = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true)
    const params = new URLSearchParams({ page, limit: PAGE_LIMIT })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    api.get(`/results/runs?${params}`)
      .then(res => {
        setRuns(res.data || [])
        setTotal(res.total || 0)
        setTotalPages(res.totalPages || 1)
      })
      .catch(err => toast.error(err.message))
      .finally(() => { if (showSpinner) setLoading(false) })
  }, [page, statusFilter]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  function handleFilterChange(f) {
    setStatusFilter(f)
    setPage(1)
  }

  const filteredRuns = sceneSearch.trim()
    ? runs.filter(r => r.sceneName?.toLowerCase().includes(sceneSearch.trim().toLowerCase()))
    : runs

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1
  const rangeEnd = Math.min(page * PAGE_LIMIT, total)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Runs</h1>
          <p className="page-subtitle">
            {total > 0
              ? `${total} run${total !== 1 ? 's' : ''}${statusFilter !== 'all' ? ` · ${statusFilter}` : ''}`
              : 'Test execution history.'
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-raised)', borderRadius: 4, padding: 2, border: '1px solid var(--border)' }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 3,
                  border: 'none', cursor: 'pointer', fontFamily: 'monospace',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  background: statusFilter === f ? 'var(--surface-hover)' : 'transparent',
                  color: statusFilter === f
                    ? (f === 'passed' ? 'var(--success)' : f === 'failed' || f === 'error' ? 'var(--error)' : f === 'pending' ? 'var(--blue)' : 'var(--text)')
                    : 'var(--text-muted)',
                  transition: 'all 0.1s',
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search scenes…"
            value={sceneSearch}
            onChange={e => setSceneSearch(e.target.value)}
            style={{
              height: 28, padding: '0 10px', fontSize: 12, borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--surface-raised)',
              color: 'var(--text)', outline: 'none', width: 160,
            }}
          />
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
        ) : runs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
              {statusFilter !== 'all' ? `No ${statusFilter} runs` : 'No runs yet'}
            </p>
            <p style={{ fontSize: 12 }}>
              {statusFilter !== 'all'
                ? 'Try a different filter.'
                : 'Results will appear here once scenes start executing.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface-raised)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Showing {rangeStart}–{rangeEnd} of {total}
              </span>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Scene</th>
                  <th>Run ID</th>
                  <th>Runners</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Completed</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map(run => (
                  <RunRow key={run.runId} run={run} />
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}
          </div>
        )}
      </div>
    </>
  )
}
