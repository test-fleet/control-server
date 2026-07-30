import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Clock, Copy, Check, RefreshCw, KeyRound, AlertTriangle, Pencil, Trash2, ToggleLeft, ToggleRight, Server, Cpu, MemoryStick, Activity } from 'lucide-react'
import Pagination from '../components/Pagination'
import ActionsMenu from '../components/ActionsMenu'
import EmptyState from '../components/EmptyState'
import StatusPulse from '../components/StatusPulse'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import Modal from '../components/Modal'
import Badge from '../components/Badge'

function runnerDisplayStatus(runner, threshold, isCredentialFlagged = false) {
  if (runner.status === 'disabled') return { variant: 'disabled', label: 'Disabled', color: 'var(--error)' }
  if (isCredentialFlagged) return { variant: 'active-warn', label: 'Active', color: 'var(--warning)' }
  if (!runner.lastSeen) return { variant: 'unresponsive', label: 'Unresponsive', color: 'var(--error)' }
  if (Date.now() - new Date(runner.lastSeen).getTime() > threshold) return { variant: 'unresponsive', label: 'Unresponsive', color: 'var(--error)' }
  return { variant: 'online', label: 'Active', color: 'var(--lime)' }
}

function formatRelative(date) {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function fmt(v, unit = '') {
  if (v === null || v === undefined) return '—'
  return `${typeof v === 'number' ? v.toFixed(v < 10 ? 1 : 0) : v}${unit}`
}

// ── CopyButton ─────────────────────────────────────────────────────────────

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button className="code-copy" onClick={copy} title="Copy">
      {copied ? <Check size={13} style={{ color: 'var(--lime)' }} /> : <Copy size={13} />}
    </button>
  )
}

function SecretReveal({ label, value }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="code-box">
        <code>{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  )
}

// ── Fleet card ─────────────────────────────────────────────────────────────

function FleetCard({ runner, threshold, flagged, isAdmin, onOpen, onRename, onToggle, onDelete }) {
  const { variant, label, color } = runnerDisplayStatus(runner, threshold, flagged)
  const pm = runner.performanceMetrics || {}
  const isLive = variant === 'online'

  return (
    <div className={`fleet-card${flagged ? ' fleet-card--flagged' : ''}`} onClick={onOpen}>
      <div className="fleet-card-top">
        <StatusPulse color={color} live={isLive} />
        <span className="fleet-card-name">{runner.name}</span>
        {isAdmin && (
          <span onClick={e => e.stopPropagation()}>
            <ActionsMenu items={[
              { label: 'Rename', icon: Pencil, onClick: onRename },
              { label: runner.status === 'disabled' ? 'Enable' : 'Disable', icon: runner.status === 'disabled' ? ToggleLeft : ToggleRight, onClick: onToggle },
              { divider: true },
              { label: 'Delete', icon: Trash2, danger: true, onClick: onDelete },
            ]} />
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <Badge variant={variant}>{label}</Badge>
        {flagged && <Badge variant="warning">Shared creds</Badge>}
      </div>

      <div className="fleet-card-metrics">
        <div className="fleet-card-metric">
          <span className="fleet-card-metric-value" style={{ color: 'var(--lime)' }}><Cpu size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{fmt(pm.cpuPercent, '%')}</span>
          <span className="fleet-card-metric-label">CPU</span>
        </div>
        <div className="fleet-card-metric">
          <span className="fleet-card-metric-value" style={{ color: 'var(--blue)' }}><MemoryStick size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{fmt(pm.memUsedMb, 'MB')}</span>
          <span className="fleet-card-metric-label">Memory</span>
        </div>
        <div className="fleet-card-metric">
          <span className="fleet-card-metric-value" style={{ color: 'var(--teal)' }}><Activity size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{fmt(pm.activeJobs)}</span>
          <span className="fleet-card-metric-label">Active Jobs</span>
        </div>
      </div>

      <div className="fleet-card-foot">
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} />{formatRelative(runner.lastSeen)}</span>
        <span className="truncate" style={{ maxWidth: 120 }}>{runner.keyId}</span>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Runners() {
  const { user, heartbeatInterval } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const threshold = heartbeatInterval * 3

  const [runners, setRunners] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [newRunner, setNewRunner] = useState(null)
  const [form, setForm] = useState({ name: '' })
  const [submitting, setSubmitting] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameForm, setRenameForm] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const limit = 24

  const fetchRunners = useCallback((showSpinner) => {
    if (showSpinner) setLoading(true)
    api.get(`/runners?page=${page}&limit=${limit}`)
      .then(data => {
        setRunners(data.data || [])
        setTotal(data.total || 0)
      })
      .catch(err => { if (showSpinner) toast.error(err.message) })
      .finally(() => { if (showSpinner) setLoading(false) })
  }, [page]) // eslint-disable-line

  const load = useCallback(() => fetchRunners(true), [fetchRunners])
  const refresh = useCallback(() => fetchRunners(false), [fetchRunners])

  useEffect(() => { load() }, [load])
  useAutoRefresh(refresh, heartbeatInterval)

  async function handleRegister(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      const data = await api.post('/runners/register', { name: form.name.trim() })
      setNewRunner({ name: form.name.trim(), apiKey: data.apiKey, apiSecret: data.apiSecret })
      setForm({ name: '' })
      setShowRegister(false)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRename(e) {
    e.preventDefault()
    if (!renameForm.trim()) return
    setSubmitting(true)
    try {
      await api.put(`/runner/${renameTarget._id}`, { name: renameForm.trim() })
      toast.success(`Runner renamed to "${renameForm.trim()}"`)
      setRenameTarget(null)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleRunner(runner) {
    const newStatus = runner.status === 'disabled' ? 'active' : 'disabled'
    try {
      await api.put(`/runner/${runner._id}`, { status: newStatus })
      toast.success(`Runner ${newStatus === 'disabled' ? 'disabled' : 'enabled'}`)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleDeleteRunner() {
    setSubmitting(true)
    try {
      await api.delete(`/runner/${deleteTarget._id}`)
      toast.success(`Runner "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const pages = Math.ceil(total / limit)
  const borrowedRunnerNames = new Set(runners.flatMap(r => r.credentialBorrowers || []))
  const isCredentialFlagged = (runner) => runner.multipleInstances || borrowedRunnerNames.has(runner.name)
  const credentialFlaggedCount = runners.filter(isCredentialFlagged).length

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Runners</h1>
          <p className="page-subtitle">{total} runner{total !== 1 ? 's' : ''} registered</p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn--secondary btn--sm" onClick={load}>
            <RefreshCw size={14} />
            Refresh
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
            {credentialFlaggedCount > 0 && (
              <div className="alert alert--warning" style={{ marginBottom: 14 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <strong>API credentials are being shared between multiple runners.</strong>{' '}
                  Each runner process should use its own unique API key and secret. Shared credentials corrupt per-runner metrics.
                </span>
              </div>
            )}

            {runners.length === 0 && !isAdmin ? (
              <div className="table-wrap">
                <EmptyState icon={Server} title="No runners registered yet" />
              </div>
            ) : (
              <div className="fleet-grid">
                {isAdmin && (
                  <button className="fleet-card fleet-card--ghost" onClick={() => setShowRegister(true)}>
                    <Plus size={18} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Register Runner</span>
                  </button>
                )}
                {runners.map(runner => (
                  <FleetCard
                    key={runner._id}
                    runner={runner}
                    threshold={threshold}
                    flagged={isCredentialFlagged(runner)}
                    isAdmin={isAdmin}
                    onOpen={() => navigate(`/runners/${runner._id}`)}
                    onRename={() => { setRenameTarget(runner); setRenameForm(runner.name) }}
                    onToggle={() => handleToggleRunner(runner)}
                    onDelete={() => setDeleteTarget(runner)}
                  />
                ))}
              </div>
            )}

            {pages > 1 && (
              <div className="table-wrap" style={{ marginTop: 12, boxShadow: 'none', background: 'none', border: 'none' }}>
                <Pagination page={page} totalPages={pages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Register Runner Modal */}
      {showRegister && (
        <Modal title="Register Runner" onClose={() => setShowRegister(false)}>
          <form onSubmit={handleRegister}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Runner Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. prod-runner-01"
                  value={form.name}
                  onChange={e => setForm({ name: e.target.value })}
                  autoFocus
                  required
                />
              </div>
              <div className="alert alert--info">
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>The API secret will only be shown once after registration. Save it immediately.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn--secondary" onClick={() => setShowRegister(false)}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={submitting || !form.name.trim()}>
                {submitting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Registering…</> : 'Register'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Credentials Modal */}
      {newRunner && (
        <Modal title="Runner Registered" onClose={() => setNewRunner(null)}>
          <div className="modal-body">
            <div className="alert alert--warning">
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span><strong>Save these credentials now.</strong> The API secret cannot be recovered after closing this dialog.</span>
            </div>
            <SecretReveal label="Runner Name" value={newRunner.name} />
            <SecretReveal label="API Key"     value={newRunner.apiKey} />
            <SecretReveal label="API Secret"  value={newRunner.apiSecret} />
            <div className="alert alert--info">
              <KeyRound size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Configure your runner with these credentials. The runner uses HMAC-SHA256 signing to authenticate heartbeats.</span>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn--primary" onClick={() => setNewRunner(null)}>I've saved the credentials</button>
          </div>
        </Modal>
      )}

      {/* Rename Runner Modal */}
      {renameTarget && (
        <Modal title="Rename Runner" onClose={() => setRenameTarget(null)}>
          <form onSubmit={handleRename}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Runner Name</label>
                <input
                  className="form-input"
                  value={renameForm}
                  onChange={e => setRenameForm(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn--secondary" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={submitting || !renameForm.trim() || renameForm.trim() === renameTarget.name}>
                {submitting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Runner Modal */}
      {deleteTarget && (
        <Modal title="Delete Runner" onClose={() => setDeleteTarget(null)}>
          <div className="modal-body">
            <p style={{ color: 'var(--text-dim)', marginBottom: 8 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{deleteTarget.name}</strong>?
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              This will permanently remove the runner and its metrics history.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn btn--danger" onClick={handleDeleteRunner} disabled={submitting}>
              {submitting
                ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Deleting…</>
                : 'Delete Runner'
              }
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
