import { useState, useEffect, useCallback } from 'react'
import { useParams, NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, AlertTriangle } from 'lucide-react'
import { api } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { frequencyLabel } from '../../lib/sceneHelpers'
import { statusColor } from '../../lib/statusColor'

function formatTimestamp(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function SceneDetailLayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [scene, setScene] = useState(null)
  const [frames, setFrames] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get(`/scene/${id}`),
      api.get(`/scenes/${id}/frames`),
    ])
      .then(([sceneRes, framesRes]) => {
        setScene(sceneRes.scene || sceneRes)
        setFrames(framesRes.frames || [])
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  const refreshFrames = useCallback(() => {
    api.get(`/scenes/${id}/frames`).then(res => setFrames(res.frames || [])).catch(() => {})
  }, [id])

  const refreshScene = useCallback(() => {
    api.get(`/scene/${id}`).then(res => setScene(res.scene || res)).catch(() => {})
  }, [id])

  async function handleToggleEnabled() {
    try {
      await api.put(`/scene/${id}`, { enabled: !scene.enabled })
      toast.success(scene.enabled ? 'Scene disabled' : 'Scene enabled')
      refreshScene()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleRunNow() {
    setRunning(true)
    try {
      const res = await api.post(`/scenes/${id}/run`, {})
      const runnerWord = res.expectedRunners === 1 ? 'runner' : 'runners'
      toast.success(`Run triggered — dispatched to ${res.expectedRunners} ${runnerWord}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner spinner--lg" />
      </div>
    )
  }

  if (!scene) {
    return (
      <div className="page-body">
        <p style={{ color: 'var(--text-muted)' }}>Scene not found.</p>
      </div>
    )
  }

  const enabledFrameCount = frames.filter(f => f.enabled).length
  const wontRun = scene.enabled && enabledFrameCount === 0

  return (
    <>
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <Link to="/scenes" className="back-link">
          <ArrowLeft size={13} />Scenes
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">{scene.name}</h1>
            <p className="page-subtitle">
              every {frequencyLabel(scene.cronSchedule)}
              {scene.description ? ` · ${scene.description}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {scene.lastRunStatus && (
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: statusColor(scene.lastRunStatus) }}>
                {scene.lastRunStatus} · {formatTimestamp(scene.lastRunAt)}
              </span>
            )}
            <button
              className={`toggle-switch${scene.enabled ? ' on' : ''}`}
              role="switch"
              aria-checked={scene.enabled}
              title={scene.enabled ? 'Disable scene' : 'Enable scene'}
              onClick={handleToggleEnabled}
            />
            <button className="btn btn--secondary btn--sm" onClick={handleRunNow} disabled={running}>
              {running ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Play size={12} />}
              Run now
            </button>
          </div>
        </div>
        {wontRun && (
          <div className="alert alert--warning" style={{ marginTop: 4 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>This scene is enabled but has no enabled frames — it will never actually run. Add or enable at least one frame below.</span>
          </div>
        )}
      </div>

      <nav className="tab-bar">
        <NavLink to={`/scenes/${id}`} end className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>Frames</NavLink>
        <NavLink to={`/scenes/${id}/runs`} className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>Runs</NavLink>
        <NavLink to={`/scenes/${id}/settings`} className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>Settings</NavLink>
      </nav>

      <div className="page-body">
        <Outlet context={{ scene, frames, refreshFrames, refreshScene, toast, navigate }} />
      </div>
    </>
  )
}
