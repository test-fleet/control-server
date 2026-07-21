import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight, Play, Search, Clapperboard } from 'lucide-react'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import ActionsMenu from '../components/ActionsMenu'
import EmptyState from '../components/EmptyState'
import StatusPulse from '../components/StatusPulse'
import Badge from '../components/Badge'
import Select from '../components/Select'
import { RunDotTrail } from '../components/Sparkline'
import { InfoField, InfoDivider } from '../components/InfoRow'
import { useGhostTileHeight } from '../hooks/useGhostTileHeight'
import { FREQUENCY_OPTIONS, THRESHOLD_OPTIONS, buildCronSchedule, frequencyLabel } from '../lib/sceneHelpers'
import { statusColor } from '../lib/statusColor'

const PAGE_SIZE_OPTIONS = [10, 20, 50]
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'passing', label: 'Passing' },
  { key: 'failing', label: 'Failing' },
  { key: 'incomplete', label: 'Incomplete' },
  { key: 'disabled', label: 'Disabled' },
]

function formatTimestamp(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ── Create modal ──────────────────────────────────────────────────────────

function CreateForm({ onSubmit, onClose, submitting }) {
  const [form, setForm] = useState({ name: '', description: '', timeout: 5, frequency: 5, passThreshold: 1.0 })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      timeout: Math.floor(Number(form.timeout) * 60000),
      cronSchedule: buildCronSchedule(form.frequency),
      passThreshold: form.passThreshold,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Scene Name <span style={{ color: 'var(--error)' }}>*</span></label>
          <input className="form-input" placeholder="e.g. Checkout API smoke test" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus required />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" placeholder="What does this scene test?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ resize: 'vertical' }} />
        </div>
        <div className="form-group">
          <label className="form-label">Frequency</label>
          <Select value={form.frequency} onChange={frequency => setForm(f => ({ ...f, frequency }))} options={FREQUENCY_OPTIONS} />
        </div>
        <div className="form-group">
          <label className="form-label">Timeout (minutes)</label>
          <input className="form-input" type="number" min={1} max={1440} value={form.timeout} onChange={e => setForm(f => ({ ...f, timeout: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Pass Threshold</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {THRESHOLD_OPTIONS.map(opt => (
              <button key={opt.value} type="button" title={opt.hint} onClick={() => setForm(f => ({ ...f, passThreshold: opt.value }))}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700,
                  borderRadius: 6, cursor: 'pointer', border: '1px solid', fontFamily: 'var(--font-mono)',
                  background: form.passThreshold === opt.value ? 'var(--blue-dim)' : 'transparent',
                  borderColor: form.passThreshold === opt.value ? 'var(--blue)' : 'var(--border)',
                  color: form.passThreshold === opt.value ? 'var(--blue-hover)' : 'var(--text-muted)',
                }}>
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
          {submitting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Creating…</> : 'Create Scene'}
        </button>
      </div>
    </form>
  )
}

// ── Scene card ───────────────────────────────────────────────────────────

function SceneCard({ scene, history, onOpen, onRunNow, onToggle, onDelete }) {
  const wontRun = scene.enabled && (scene.frameIds?.length ?? 0) === 0
  const color = statusColor(scene.lastRunStatus)

  return (
    <div className="fleet-card" onClick={onOpen}>
      <div className="fleet-card-top">
        <StatusPulse color={color} live={scene.lastRunStatus === 'passed' && scene.enabled} />
        <span className="fleet-card-name">{scene.name}</span>
        <Badge variant={scene.enabled ? 'active' : 'disabled'}>{scene.enabled ? 'Enabled' : 'Disabled'}</Badge>
        {wontRun && <Badge variant="warning">Won't run</Badge>}
        <span onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto' }}>
          <ActionsMenu items={[
            { label: scene.enabled ? 'Disable' : 'Enable', icon: scene.enabled ? ToggleRight : ToggleLeft, onClick: onToggle },
            { divider: true },
            { label: 'Delete', icon: Trash2, danger: true, onClick: onDelete },
          ]} />
        </span>
      </div>

      {scene.description && (
        <p className="truncate text-muted" style={{ fontSize: 11.5, margin: 0 }}>{scene.description}</p>
      )}

      <div className="monospace" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <InfoField label="Last run">
          <span style={{ color }}>{scene.lastRunStatus || 'no runs'}</span>
          {scene.lastRunAt && <span style={{ color: 'var(--text-dim)' }}> · {formatTimestamp(scene.lastRunAt)}</span>}
        </InfoField>
        <InfoDivider />
        <InfoField label="Pass">{scene.lastPassAt ? formatTimestamp(scene.lastPassAt) : '—'}</InfoField>
        <InfoDivider />
        <InfoField label="Fail">{scene.lastFailAt ? formatTimestamp(scene.lastFailAt) : '—'}</InfoField>
        <InfoDivider />
        <InfoField label="Recent"><RunDotTrail runs={history || []} /></InfoField>
        <span style={{ marginLeft: 'auto' }}>every {frequencyLabel(scene.cronSchedule)}</span>
        <button
          className="btn btn--ghost btn--sm"
          style={{ color: 'var(--blue)', padding: '2px 8px' }}
          title="Run now"
          onClick={e => { e.stopPropagation(); onRunNow() }}
        >
          <Play size={11} />Run
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function Scenes() {
  const navigate = useNavigate()
  const toast = useToast()

  const [scenes, setScenes] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [histories, setHistories] = useState({})

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

  useEffect(() => {
    if (scenes.length === 0) return
    Promise.allSettled(scenes.map(s => api.get(`/results/scene/${s.id}/summary`)))
      .then(results => {
        const map = {}
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') map[scenes[i].id] = (r.value.recentRuns || []).map(run => run.status)
        })
        setHistories(map)
      })
  }, [scenes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scenes.filter(s => {
      if (q && !s.name.toLowerCase().includes(q) && !s.description?.toLowerCase().includes(q)) return false
      if (filter === 'passing') return s.lastRunStatus === 'passed'
      if (filter === 'failing') return s.lastRunStatus === 'failed' || s.lastRunStatus === 'error'
      if (filter === 'incomplete') return s.lastRunStatus === 'incomplete'
      if (filter === 'disabled') return !s.enabled
      return true
    })
  }, [scenes, query, filter])

  const [listRef, ghostHeight] = useGhostTileHeight([filtered])

  async function handleCreate(fields) {
    setSubmitting(true)
    try {
      const res = await api.post('/scene', fields)
      toast.success(`Scene "${fields.name}" created`)
      setShowCreate(false)
      navigate(`/scenes/${res.scene.id}`)
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
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner--lg" />
          </div>
        ) : (
          <>
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px', minWidth: 160 }}>
                  <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    className="form-input"
                    placeholder="Search scenes…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12, height: 28, border: 'none', background: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {FILTERS.map(f => (
                    <button
                      key={f.key}
                      className={`btn btn--sm ${filter === f.key ? 'btn--secondary' : 'btn--ghost'}`}
                      onClick={() => setFilter(f.key)}
                      style={{ fontSize: 11 }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {total > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    <label style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Per page</label>
                    <Select
                      value={limit}
                      onChange={n => { setLimit(n); setPage(1) }}
                      options={PAGE_SIZE_OPTIONS.map(n => ({ value: n, label: String(n) }))}
                      wrapperStyle={{ width: 'auto' }}
                      style={{ padding: '3px 8px', fontSize: 12, height: 28 }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="wide-list" ref={listRef}>
              <button className="fleet-card fleet-card--ghost" style={ghostHeight ? { minHeight: ghostHeight } : undefined} onClick={() => setShowCreate(true)}>
                <Plus size={16} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>New Scene</span>
              </button>

              {filtered.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={Clapperboard}
                    title={scenes.length === 0 ? 'No scenes yet' : 'No scenes match'}
                    subtitle={scenes.length === 0 ? 'Create one above to define the HTTP requests your runners will execute.' : 'Try a different search or filter.'}
                  />
                </div>
              ) : (
                filtered.map(scene => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    history={histories[scene.id]}
                    onOpen={() => navigate(`/scenes/${scene.id}`)}
                    onRunNow={() => handleRunNow(scene)}
                    onToggle={() => handleToggle(scene)}
                    onDelete={() => setDeleteTarget(scene)}
                  />
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="table-wrap" style={{ marginTop: 12, boxShadow: 'none', background: 'none', border: 'none' }}>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <Modal title="New Scene" onClose={() => setShowCreate(false)}>
          <CreateForm onSubmit={handleCreate} onClose={() => setShowCreate(false)} submitting={submitting} />
        </Modal>
      )}

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
              {submitting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Deleting…</> : 'Delete Scene'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
