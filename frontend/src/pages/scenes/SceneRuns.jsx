import { useState, useEffect, useCallback } from 'react'
import { useOutletContext, Link, useNavigate } from 'react-router-dom'
import { PlayCircle } from 'lucide-react'
import { api } from '../../api/client'
import Pagination from '../../components/Pagination'
import EmptyState from '../../components/EmptyState'
import StatusPulse from '../../components/StatusPulse'
import { statusColor } from '../../lib/statusColor'

const PAGE_LIMIT = 20

function formatTimestamp(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function SceneRuns() {
  const { scene, toast } = useOutletContext()
  const navigate = useNavigate()

  const [runs, setRuns] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/results/runs?sceneId=${scene.id}&page=${page}&limit=${PAGE_LIMIT}`)
      .then(res => {
        setRuns(res.data || [])
        setTotal(res.total || 0)
        setTotalPages(res.totalPages || 1)
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [scene.id, page]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner spinner--lg" /></div>
  }

  if (runs.length === 0) {
    return (
      <div className="table-wrap">
        <EmptyState icon={PlayCircle} title="No runs yet" subtitle="Results will appear here once this scene executes, on schedule or via Run now." />
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} run{total !== 1 ? 's' : ''}</span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Runners</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Completed</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => (
            <tr key={run.runId} onClick={() => navigate(`/runs/${run.runId}`)} style={{ cursor: 'pointer' }}>
              <td>
                <Link to={`/runs/${run.runId}`} onClick={e => e.stopPropagation()} className="monospace" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
                  {run.runId?.slice(0, 24)}…
                </Link>
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <StatusPulse color={statusColor(run.status)} live={run.status === 'pending'} size={7} />
                  <span className="monospace" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {run.status === 'pending' ? `${run.reportedRunners}/${run.expectedRunners} reported` : `${run.passedRunners}/${run.expectedRunners} passed`}
                  </span>
                </div>
              </td>
              <td><span className="monospace" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{run.status}</span></td>
              <td className="monospace text-muted" style={{ fontSize: 12 }}>{run.durationMs != null ? `${run.durationMs}ms` : '—'}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatTimestamp(run.completedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  )
}
