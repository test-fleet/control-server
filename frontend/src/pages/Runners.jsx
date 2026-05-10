import { useState, useEffect, useCallback } from 'react'
import { Plus, Clock, Copy, Check, RefreshCw, KeyRound, AlertTriangle, WifiOff } from 'lucide-react'
import Pagination from '../components/Pagination'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import Modal from '../components/Modal'
import Badge from '../components/Badge'

const MAX_HISTORY = 60

// ── AddRow ─────────────────────────────────────────────────────────────────

function AddRow({ colSpan, label, onClick }) {
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
          {label}
        </div>
      </td>
    </tr>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function runnerDisplayStatus(runner, threshold) {
  if (runner.status === 'disabled') return { variant: 'disabled', label: 'Disabled' }
  if (!runner.lastSeen) return { variant: 'unresponsive', label: 'Unresponsive' }
  if (Date.now() - new Date(runner.lastSeen).getTime() > threshold) return { variant: 'unresponsive', label: 'Unresponsive' }
  if (runner.status === 'offline') return { variant: 'offline', label: 'Offline' }
  return { variant: 'online', label: 'Active' }
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

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmt(v, decimals = 1) {
  if (v === null || v === undefined) return '—'
  return typeof v === 'number' ? v.toFixed(v < 10 ? 2 : decimals) : String(v)
}

function stats(vals) {
  const clean = vals.filter(v => v !== null && v !== undefined)
  if (!clean.length) return { min: null, avg: null, max: null }
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const avg = clean.reduce((a, b) => a + b, 0) / clean.length
  return { min, avg, max }
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

// ── Chart tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  const time = label ? new Date(label).toLocaleTimeString() : ''
  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-bright)',
      borderRadius: 8,
      padding: '7px 11px',
      fontSize: 12,
      fontFamily: 'monospace',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 3, fontSize: 10 }}>{time}</div>
      <div style={{ color: payload[0]?.stroke, fontWeight: 700 }}>
        {value !== null && value !== undefined
          ? `${fmt(value)}${unit}`
          : '—'}
      </div>
    </div>
  )
}

// ── MetricChart ────────────────────────────────────────────────────────────

function MetricChart({ label, unit, dataKey, history, color, height = 90 }) {
  const points = (history || []).map(p => ({
    time: new Date(p.time).getTime(),
    v: p[dataKey],
  })).filter(p => p.v !== null && p.v !== undefined)

  const allVals = points.map(p => p.v)
  const { min, avg, max } = stats(allVals)
  const yMin = allVals.length ? Math.max(0, Math.min(...allVals) * 0.85) : 0
  const yMax = allVals.length ? Math.max(...allVals) * 1.15 : 10

  const current = history?.length
    ? history[history.length - 1]?.[dataKey]
    : null

  return (
    <div style={{ flex: 1, minWidth: 0, padding: '14px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
          {label}
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
          {fmt(current)}{current !== null && current !== undefined ? unit : ''}
        </span>
      </div>

      {/* Min / avg / max */}
      {allVals.length > 1 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          {[['min', min], ['avg', avg], ['max', max]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', textTransform: 'uppercase' }}>{k}</span>
              <span style={{ fontSize: 10, color: color, fontFamily: 'monospace', fontWeight: 600 }}>{fmt(v)}{unit}</span>
            </div>
          ))}
        </div>
      )}

      {points.length >= 2 ? (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={points} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.18} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tickFormatter={t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              minTickGap={60}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v.toFixed(0)}
            />
            <Tooltip
              content={<ChartTooltip unit={unit} />}
              cursor={{ stroke: 'var(--border-bright)', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#grad-${label})`}
              dot={false}
              activeDot={{ r: 3, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {points.length === 0 ? 'No data' : 'Collecting…'}
          </span>
        </div>
      )}
    </div>
  )
}

// ── RunnerMetrics (modal body content) ────────────────────────────────────

function RunnerMetrics({ runner, history, threshold, heartbeatInterval }) {
  const { variant, label } = runnerDisplayStatus(runner, threshold)
  const isDisconnected = ['unresponsive', 'offline', 'disabled'].includes(variant)

  const pm = runner.performanceMetrics || {}
  const hasMetrics = pm.recordedAt !== null && pm.recordedAt !== undefined
  const hist = history || []

  const approxWindowMins = hist.length > 1
    ? Math.round((new Date(hist[hist.length - 1].time) - new Date(hist[0].time)) / 60000)
    : null

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        filter: isDisconnected ? 'blur(3px)' : 'none',
        opacity: isDisconnected ? 0.35 : 1,
        pointerEvents: isDisconnected ? 'none' : 'auto',
        userSelect: isDisconnected ? 'none' : 'auto',
        transition: 'filter 0.2s, opacity 0.2s',
      }}>
        {/* Main metric charts */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <MetricChart label="CPU"    unit="%"   dataKey="cpu"  history={hist} color="var(--lime)"  height={100} />
          <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
          <MetricChart label="Memory" unit=" MB" dataKey="mem"  history={hist} color="var(--blue)"  height={100} />
          <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
          <MetricChart label="Heap"   unit=" MB" dataKey="heap" history={hist} color="var(--peach)" height={100} />
        </div>

        {/* Secondary charts: workers + active jobs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <MetricChart label="Workers"     unit="" dataKey="workers"    history={hist} color="var(--purple, #a78bfa)" height={70} />
          <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
          <MetricChart label="Active Jobs" unit="" dataKey="activeJobs" history={hist} color="var(--teal, #2dd4bf)"  height={70} />
          <div style={{ flex: 1 }} />
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '8px 16px',
          fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)',
        }}>
          {pm.recordedAt && (
            <span>updated {formatRelative(pm.recordedAt)}</span>
          )}
          {hist.length > 0 && (
            <span>{hist.length} samples{approxWindowMins !== null ? ` · ~${approxWindowMins}m window` : ''}</span>
          )}
          <span style={{ marginLeft: 'auto' }}>
            registered {formatDate(runner.createdAt)}
          </span>
        </div>
      </div>

      {/* Disconnected overlay */}
      {isDisconnected && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 6,
        }}>
          <WifiOff size={18} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'monospace' }}>
            No Data
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Runner is {label.toLowerCase()}
          </span>
        </div>
      )}

      {/* Active but no metrics yet */}
      {!isDisconnected && !hasMetrics && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            Waiting for first heartbeat with metrics…
          </span>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Runners() {
  const { user, heartbeatInterval } = useAuth()
  const toast = useToast()
  const isAdmin = user?.role === 'admin'
  const threshold = heartbeatInterval * 3

  const [runners, setRunners] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [metricsHistory, setMetricsHistory] = useState({})
  const [showRegister, setShowRegister] = useState(false)
  const [newRunner, setNewRunner] = useState(null)
  const [form, setForm] = useState({ name: '' })
  const [submitting, setSubmitting] = useState(false)

  const limit = 20

  const mergeHistory = useCallback((id, incoming) => {
    setMetricsHistory(prev => {
      const existing = prev[id] || []
      if (!incoming.length) return prev
      const lastExisting = existing[existing.length - 1]?.time
      const newPoints = existing.length === 0
        ? incoming
        : incoming.filter(p => !lastExisting || p.time > lastExisting)
      if (!newPoints.length) return prev
      const merged = [...existing, ...newPoints].slice(-MAX_HISTORY)
      return { ...prev, [id]: merged }
    })
  }, [])

  const updateHistoryFromPoll = useCallback((list) => {
    setMetricsHistory(prev => {
      const next = { ...prev }
      let changed = false
      list.forEach(r => {
        const pm = r.performanceMetrics
        if (!pm?.recordedAt) return
        const existing = next[r._id] || []
        const last = existing[existing.length - 1]
        if (last?.time === pm.recordedAt) return
        changed = true
        next[r._id] = [
          ...existing.slice(-(MAX_HISTORY - 1)),
          {
            time:       pm.recordedAt,
            cpu:        pm.cpuPercent,
            mem:        pm.memUsedMb,
            heap:       pm.heapAllocMb,
            workers:    pm.workers,
            activeJobs: pm.activeJobs,
          },
        ]
      })
      return changed ? next : prev
    })
  }, [])

  const fetchRunners = useCallback((showSpinner) => {
    if (showSpinner) setLoading(true)
    api.get(`/runners?page=${page}&limit=${limit}`)
      .then(data => {
        const list = data.data || []
        setRunners(list)
        setTotal(data.total || 0)
        updateHistoryFromPoll(list)
      })
      .catch(err => { if (showSpinner) toast.error(err.message) })
      .finally(() => { if (showSpinner) setLoading(false) })
  }, [page, updateHistoryFromPoll]) // eslint-disable-line

  const load = useCallback(() => fetchRunners(true), [fetchRunners])
  const refresh = useCallback(() => fetchRunners(false), [fetchRunners])

  useEffect(() => { load() }, [load])
  useAutoRefresh(refresh, heartbeatInterval)

  // Seed history from Redis when a runner modal is opened
  useEffect(() => {
    if (!selectedId) return
    api.get(`/runner/${selectedId}/metrics`)
      .then(data => {
        const points = data.metrics || []
        if (points.length) mergeHistory(selectedId, points)
      })
      .catch(() => {})
  }, [selectedId]) // eslint-disable-line

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

  const selectedRunner = runners.find(r => r._id === selectedId) || null
  const pages = Math.ceil(total / limit)

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
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Last Seen</th>
                    <th>API Key</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {isAdmin && <AddRow colSpan={5} label="Register Runner" onClick={() => setShowRegister(true)} />}
                  {runners.map(runner => {
                    return (
                      <tr
                        key={runner._id}
                        onClick={() => setSelectedId(runner._id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div style={{ fontWeight: 500 }}>{runner.name}</div>
                        </td>
                        <td>
                          {(() => {
                            const { variant, label } = runnerDisplayStatus(runner, threshold)
                            return <Badge variant={variant}>{label}</Badge>
                          })()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                            <Clock size={12} />
                            {formatRelative(runner.lastSeen)}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                            <span className="monospace text-muted">{runner.keyId}</span>
                            <CopyButton value={runner.keyId} />
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {formatDate(runner.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                  {!isAdmin && runners.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                        No runners registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {pages > 1 && (
                <Pagination page={page} totalPages={pages} onPageChange={setPage} />
              )}
            </div>
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

      {/* Runner metrics modal */}
      {selectedRunner && (() => {
        const { variant, label } = runnerDisplayStatus(selectedRunner, threshold)
        return (
          <Modal
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{selectedRunner.name}</span>
                <Badge variant={variant}>{label}</Badge>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={10} />
                  {formatRelative(selectedRunner.lastSeen)}
                </span>
              </div>
            }
            onClose={() => setSelectedId(null)}
            xl
          >
            <RunnerMetrics
              runner={selectedRunner}
              history={metricsHistory[selectedRunner._id]}
              threshold={threshold}
              heartbeatInterval={heartbeatInterval}
            />
          </Modal>
        )
      })()}
    </>
  )
}
