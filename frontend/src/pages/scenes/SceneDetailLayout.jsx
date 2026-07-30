import { useState, useEffect, useCallback } from 'react'
import { useParams, NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, AlertTriangle } from 'lucide-react'
import { api } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useNavGuard } from '../../context/NavGuardContext'
import { frequencyLabel, transformFrameForApi } from '../../lib/sceneHelpers'
import { statusColor } from '../../lib/statusColor'
import Modal from '../../components/Modal'

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
  const { setGuard, requestNavigation } = useNavGuard()

  const [scene, setScene] = useState(null)
  const [frames, setFrames] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  // Lives here (not in SceneFrames) so it survives switching to the Runs/Settings
  // tab and back — SceneFrames unmounts on tab navigation since it's routed
  // through <Outlet>, which was silently discarding any not-yet-saved frames.
  const [staged, setStaged] = useState([])
  const [committing, setCommitting] = useState(false)
  // Set by SceneFrames whenever there's an in-progress frame draft (new or
  // being edited) that hasn't been staged/saved yet — null when there's
  // nothing at risk. Used to intercept tab clicks below (local guard) and
  // registered with the global nav guard (see effect below) so rail links,
  // the command palette, and the back-link catch it too.
  const [unsavedFrame, setUnsavedFrame] = useState(null)
  const [pendingPath, setPendingPath] = useState(null)
  const [resolvingNav, setResolvingNav] = useState(false)

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

  const handleSceneGone = useCallback((err) => {
    if (err.status === 404) {
      toast.error('This scene no longer exists')
      navigate('/scenes')
      return true
    }
    return false
  }, [toast, navigate])

  const refreshFrames = useCallback(() => {
    api.get(`/scenes/${id}/frames`).then(res => setFrames(res.frames || [])).catch(err => { handleSceneGone(err) })
  }, [id, handleSceneGone])

  const refreshScene = useCallback(() => {
    api.get(`/scene/${id}`).then(res => setScene(res.scene || res)).catch(err => { handleSceneGone(err) })
  }, [id, handleSceneGone])

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

  // Lives here (not in SceneFrames) for the same reason `staged` does — it
  // needs to survive both tab switches and be callable from the global nav
  // guard below, which fires from outside SceneFrames entirely (rail links,
  // ⌘K). Returns whether every staged frame actually saved, so callers know
  // it's safe to navigate away.
  async function commitAll() {
    setCommitting(true)
    let addedCount = 0
    const total = staged.length
    for (const f of staged) {
      try {
        const { extractors, assertions, headers } = transformFrameForApi(f)
        await api.post(`/scenes/${scene.id}/frames`, {
          name: f.name.trim(),
          enabled: f.enabled,
          request: { method: f.method, url: f.url.trim(), headers, body: f.body.trim(), timeout: Math.floor(Number(f.timeout) * 1000) },
          extractors,
          assertions,
        })
        addedCount++
      } catch (err) {
        toast.error(`Failed to save "${f.name}": ${err.message}`)
      }
    }
    setStaged(s => s.slice(addedCount))
    if (addedCount > 0) {
      toast.success(`${addedCount} frame${addedCount !== 1 ? 's' : ''} saved`)
      refreshFrames()
      refreshScene()
    }
    setCommitting(false)
    return addedCount === total
  }

  // Registers with the global nav guard (rail links, ⌘K, and this page's own
  // back-link) whenever there's something that'd be silently lost by leaving
  // the scene entirely. Deliberately separate from guardNav below: switching
  // between the Frames/Runs/Settings tabs already preserves `staged` (it
  // lives here, not in SceneFrames), so only the in-progress draft needs
  // guarding for *that* narrower case — staged frames only need a prompt
  // when actually leaving the page.
  useEffect(() => {
    if (unsavedFrame) {
      setGuard({
        title: unsavedFrame.mode === 'new' ? 'Unsaved frame' : 'Unsaved changes',
        message: unsavedFrame.mode === 'new'
          ? "You're in the middle of adding a new frame. Stage it before leaving, or discard it?"
          : 'You have unsaved changes to this frame. Save them before leaving, or discard them?',
        hint: !unsavedFrame.canCommit
          ? `Name and URL are required before this frame can be ${unsavedFrame.mode === 'new' ? 'staged' : 'saved'} — you can still discard it.`
          : null,
        canConfirm: unsavedFrame.canCommit,
        confirmLabel: unsavedFrame.mode === 'new' ? 'Stage & Leave' : 'Save & Leave',
        confirmingLabel: unsavedFrame.mode === 'new' ? 'Staging' : 'Saving',
        onConfirm: unsavedFrame.commit,
        onDiscard: unsavedFrame.discard,
      })
    } else if (staged.length > 0) {
      setGuard({
        title: 'Unsaved frames',
        message: `You have ${staged.length} staged frame${staged.length !== 1 ? 's' : ''} that ${staged.length !== 1 ? "haven't" : "hasn't"} been saved to this scene yet.`,
        hint: null,
        canConfirm: true,
        confirmLabel: `Save ${staged.length} Frame${staged.length !== 1 ? 's' : ''}`,
        confirmingLabel: 'Saving',
        onConfirm: commitAll,
        onDiscard: () => setStaged([]),
      })
    } else {
      setGuard(null)
    }
    return () => setGuard(null)
  }, [unsavedFrame, staged]) // eslint-disable-line

  function guardNav(e, path) {
    if (unsavedFrame) {
      e.preventDefault()
      setPendingPath(path)
    }
  }

  async function resolvePendingNav(action) {
    if (action === 'cancel') { setPendingPath(null); return }
    if (action === 'stage') {
      setResolvingNav(true)
      const ok = await unsavedFrame.commit()
      setResolvingNav(false)
      if (!ok) return // validation/save failed — stay put, dialog stays open
    } else if (action === 'discard') {
      unsavedFrame.discard()
    }
    const path = pendingPath
    setPendingPath(null)
    navigate(path)
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
        <Link to="/scenes" className="back-link" onClick={e => { e.preventDefault(); requestNavigation(navigate, '/scenes') }}>
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
        <NavLink to={`/scenes/${id}`} end onClick={e => guardNav(e, `/scenes/${id}`)} className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>Frames</NavLink>
        <NavLink to={`/scenes/${id}/runs`} onClick={e => guardNav(e, `/scenes/${id}/runs`)} className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>Runs</NavLink>
        <NavLink to={`/scenes/${id}/settings`} onClick={e => guardNav(e, `/scenes/${id}/settings`)} className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>Settings</NavLink>
      </nav>

      <div className="page-body">
        <Outlet context={{ scene, frames, refreshFrames, refreshScene, toast, navigate, staged, setStaged, committing, commitAll, setUnsavedFrame }} />
      </div>

      {pendingPath && unsavedFrame && (
        <Modal title="Unsaved frame" onClose={() => resolvePendingNav('cancel')}>
          <div className="modal-body">
            <p style={{ color: 'var(--text-dim)' }}>
              {unsavedFrame.mode === 'new'
                ? "You're in the middle of adding a new frame. Stage it before leaving, or discard it?"
                : 'You have unsaved changes to this frame. Save them before leaving, or discard them?'}
            </p>
            {!unsavedFrame.canCommit && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Name and URL are required before this frame can be {unsavedFrame.mode === 'new' ? 'staged' : 'saved'} — you can still discard it.
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={() => resolvePendingNav('cancel')}>Cancel</button>
            <button className="btn btn--ghost" style={{ color: 'var(--error)' }} onClick={() => resolvePendingNav('discard')}>Discard</button>
            <button className="btn btn--primary" disabled={!unsavedFrame.canCommit || resolvingNav} onClick={() => resolvePendingNav('stage')}>
              {resolvingNav
                ? <><div className="spinner" style={{ width: 12, height: 12 }} />{unsavedFrame.mode === 'new' ? 'Staging…' : 'Saving…'}</>
                : (unsavedFrame.mode === 'new' ? 'Stage & Leave' : 'Save & Leave')}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
