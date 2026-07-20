import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import RunDetailPanel, { statusColor } from '../components/RunDetailPanel'

function formatTimestamp(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function RunDetail() {
  const { runId } = useParams()
  const toast = useToast()

  const [data, setData] = useState(null)
  const [allFrames, setAllFrames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/results/run/${runId}`)
      .then(async res => {
        setData(res.data)
        if (res.data?.sceneId) {
          try {
            const framesRes = await api.get(`/scenes/${res.data.sceneId}/frames`)
            setAllFrames(framesRes.frames || [])
          } catch { /* scene may have been deleted since this run */ }
        }
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [runId]) // eslint-disable-line

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner--lg" /></div>
  if (!data) return <div className="page-body"><p style={{ color: 'var(--text-muted)' }}>Run not found.</p></div>

  return (
    <>
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        {data.sceneId && <Link to={`/scenes/${data.sceneId}/runs`} className="back-link"><ArrowLeft size={13} />{data.sceneName || 'Scene'}</Link>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="page-title">{data.sceneName || 'Run'}</h1>
          <span className="monospace" style={{ fontSize: 12, fontWeight: 700, color: statusColor(data.status) }}>{data.status}</span>
        </div>
        <p className="page-subtitle monospace">
          {data.runId} · {data.passedRunners}/{data.expectedRunners} runners passed · {data.durationMs != null ? `${data.durationMs}ms` : '—'} · {formatTimestamp(data.completedAt)}
        </p>
      </div>

      <div className="page-body">
        <div className="card">
          <RunDetailPanel data={data} allFrames={allFrames} />
        </div>
      </div>
    </>
  )
}
