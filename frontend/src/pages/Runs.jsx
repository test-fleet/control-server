import { useState, useEffect, useCallback, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, PlayCircle } from 'lucide-react'
import { api } from '../api/client'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'
import StatusPulse from '../components/StatusPulse'
import RunDetailPanel, { statusColor } from '../components/RunDetailPanel'
import { useToast } from '../context/ToastContext'

const PAGE_LIMIT = 20

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

export default function Runs() {
  const toast = useToast()
  const [runs, setRuns] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [detailCache, setDetailCache] = useState({})

  const load = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true)
    api.get(`/results/runs?page=${page}&limit=${PAGE_LIMIT}`)
      .then(res => {
        setRuns(res.data || [])
        setTotal(res.total || 0)
        setTotalPages(res.totalPages || 1)
      })
      .catch(err => toast.error(err.message))
      .finally(() => { if (showSpinner) setLoading(false) })
  }, [page]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function toggleExpand(run) {
    if (expandedId === run.runId) { setExpandedId(null); return }
    setExpandedId(run.runId)
    if (detailCache[run.runId]) return
    setDetailCache(c => ({ ...c, [run.runId]: { loading: true } }))
    try {
      const res = await api.get(`/results/run/${run.runId}`)
      let allFrames = []
      if (res.data?.sceneId) {
        try {
          const framesRes = await api.get(`/scenes/${res.data.sceneId}/frames`)
          allFrames = framesRes.frames || []
        } catch { /* scene may have been deleted since this run */ }
      }
      setDetailCache(c => ({ ...c, [run.runId]: { data: res.data, allFrames, loading: false } }))
    } catch (err) {
      setDetailCache(c => ({ ...c, [run.runId]: { error: err.message, loading: false } }))
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1
  const rangeEnd = Math.min(page * PAGE_LIMIT, total)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Runs</h1>
          <p className="page-subtitle">
            {total > 0 ? `${total} run${total !== 1 ? 's' : ''}` : 'Test execution history.'}
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
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
          <div className="table-wrap">
            <EmptyState icon={PlayCircle} title="No runs yet" subtitle="Results will appear here once scenes start executing." />
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
                </tr>
              </thead>
              <tbody>
                {runs.map(run => {
                  const color = statusColor(run.status)
                  const runnersLabel = run.status === 'pending'
                    ? `${run.reportedRunners}/${run.expectedRunners} reported`
                    : `${run.passedRunners}/${run.expectedRunners} passed`
                  const isExpanded = expandedId === run.runId
                  const detail = detailCache[run.runId]
                  return (
                    <Fragment key={run.runId}>
                      <tr onClick={() => toggleExpand(run)} style={{ cursor: 'pointer', background: isExpanded ? 'var(--surface-hover)' : undefined }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <StatusPulse color={color} live={run.status === 'pending'} size={8} />
                            <span style={{ fontWeight: 500 }}>{run.sceneName}</span>
                          </div>
                        </td>
                        <td><span className="monospace" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{run.runId?.slice(0, 20)}…</span></td>
                        <td><span className="monospace" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{runnersLabel}</span></td>
                        <td><span className="monospace" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{run.status}</span></td>
                        <td className="monospace text-muted" style={{ fontSize: 12 }}>{run.durationMs != null ? `${run.durationMs}ms` : '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatTimestamp(run.completedAt)}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0, background: 'var(--surface-raised)' }}>
                            <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
                              {!detail || detail.loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                                  <div className="spinner" />
                                </div>
                              ) : detail.error ? (
                                <p style={{ color: 'var(--error)', fontSize: 12 }}>{detail.error}</p>
                              ) : (
                                <>
                                  {detail.data.sceneId && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                                      <Link
                                        to={`/scenes/${detail.data.sceneId}`}
                                        onClick={e => e.stopPropagation()}
                                        className="btn btn--secondary btn--sm"
                                        style={{ textDecoration: 'none' }}
                                      >
                                        View Scene
                                      </Link>
                                    </div>
                                  )}
                                  <RunDetailPanel data={detail.data} allFrames={detail.allFrames} />
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
    </>
  )
}
