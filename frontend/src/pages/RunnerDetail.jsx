import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, AlertTriangle, WifiOff } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import Badge from '../components/Badge'

const MAX_HISTORY = 60

function runnerDisplayStatus(runner, threshold, isCredentialFlagged = false) {
  if (runner.status === 'disabled') return { variant: 'disabled', label: 'Disabled' }
  if (isCredentialFlagged) return { variant: 'active-warn', label: 'Active' }
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

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  const time = label ? new Date(label).toLocaleTimeString() : ''
  return (
    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: '7px 11px', fontSize: 12, fontFamily: 'var(--font-mono)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 3, fontSize: 10 }}>{time}</div>
      <div style={{ color: payload[0]?.stroke, fontWeight: 700 }}>{value !== null && value !== undefined ? `${fmt(value)}${unit}` : '—'}</div>
    </div>
  )
}

function MetricChart({ label, unit, dataKey, history, color, height = 90, heartbeatInterval = 30000 }) {
  const now = Date.now()
  const windowMs = MAX_HISTORY * heartbeatInterval
  const xDomain = [now - windowMs, now]

  const points = (history || []).map(p => ({ time: new Date(p.time).getTime(), v: p[dataKey] })).filter(p => p.v !== null && p.v !== undefined && p.time >= xDomain[0])
  const allVals = points.map(p => p.v)
  const { min, avg, max } = stats(allVals)
  const yMin = allVals.length ? Math.max(0, Math.min(...allVals) * 0.85) : 0
  const yMax = allVals.length ? Math.max(...allVals) * 1.15 : 10
  const current = history?.length ? history[history.length - 1]?.[dataKey] : null
  const isEmpty = points.length === 0

  return (
    <div style={{ flex: 1, minWidth: 0, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>{label}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>{fmt(current)}{current !== null && current !== undefined ? unit : ''}</span>
      </div>
      {allVals.length > 1 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          {[['min', min], ['avg', avg], ['max', max]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{k}</span>
              <span style={{ fontSize: 10, color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(v)}{unit}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={points} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="time" type="number" domain={xDomain} scale="time"
              tickFormatter={t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} tickLine={false}
              axisLine={{ stroke: 'var(--border)' }} minTickGap={60} />
            <YAxis domain={[yMin, yMax]} tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(0)} />
            {!isEmpty && <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: 'var(--border-bright)', strokeWidth: 1, strokeDasharray: '3 3' }} />}
            <Area type="monotone" dataKey="v" stroke={isEmpty ? 'transparent' : color} strokeWidth={1.5} fill={isEmpty ? 'transparent' : `url(#grad-${label})`} dot={false} activeDot={isEmpty ? false : { r: 3, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
        {isEmpty && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>awaiting data</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RunnerDetail() {
  const { id } = useParams()
  const { heartbeatInterval } = useAuth()
  const toast = useToast()
  const threshold = heartbeatInterval * 3

  const [runner, setRunner] = useState(null)
  const [borrowedNames, setBorrowedNames] = useState(new Set())
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback((showSpinner) => {
    if (showSpinner) setLoading(true)
    Promise.all([
      api.get(`/runners?limit=200`),
      api.get(`/runner/${id}/metrics`),
    ]).then(([runnersRes, metricsRes]) => {
      const allRunners = runnersRes.data || []
      const found = allRunners.find(r => r._id === id)
      setRunner(found || null)
      // credentialBorrowers lives on the *victim* runner (whose key got used
      // under another name) — so whether THIS runner is flagged depends on
      // whether its own name shows up in anyone's list, not on its own list.
      setBorrowedNames(new Set(allRunners.flatMap(r => r.credentialBorrowers || [])))
      if (metricsRes.metrics?.length) setHistory(metricsRes.metrics.slice(-MAX_HISTORY))
    }).catch(err => { if (showSpinner) toast.error(err.message) })
      .finally(() => { if (showSpinner) setLoading(false) })
  }, [id]) // eslint-disable-line

  useEffect(() => { load(true) }, [load])
  useAutoRefresh(() => load(false), heartbeatInterval)

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner--lg" /></div>
  if (!runner) return <div className="page-body"><p style={{ color: 'var(--text-muted)' }}>Runner not found.</p></div>

  const isCredentialFlagged = runner.multipleInstances || borrowedNames.has(runner.name)
  const { variant, label } = runnerDisplayStatus(runner, threshold, isCredentialFlagged)
  const isDisconnected = ['unresponsive', 'offline', 'disabled'].includes(variant)
  const pm = runner.performanceMetrics || {}
  const hasMetrics = pm.recordedAt !== null && pm.recordedAt !== undefined
  const approxWindowMins = history.length > 1 ? Math.round((new Date(history[history.length - 1].time) - new Date(history[0].time)) / 60000) : null

  return (
    <>
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <Link to="/runners" className="back-link"><ArrowLeft size={13} />Runners</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="page-title">{runner.name}</h1>
          <Badge variant={variant}>{label}</Badge>
          {isCredentialFlagged && <Badge variant="warning">Shared Credentials</Badge>}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} />{formatRelative(runner.lastSeen)}
          </span>
        </div>
        {isCredentialFlagged && (
          <div className="alert alert--warning">
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span><strong>API credentials are being shared between multiple runners.</strong> Each runner process should use its own unique API key and secret. Shared credentials corrupt these metrics.</span>
          </div>
        )}
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0, position: 'relative', overflow: 'hidden' }}>
          <div style={{ filter: isDisconnected ? 'blur(3px)' : 'none', opacity: isDisconnected ? 0.35 : 1, pointerEvents: isDisconnected ? 'none' : 'auto' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              <MetricChart label="CPU" unit="%" dataKey="cpu" history={history} color="var(--lime)" height={100} heartbeatInterval={heartbeatInterval} />
              <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
              <MetricChart label="Memory" unit=" MB" dataKey="mem" history={history} color="var(--blue)" height={100} heartbeatInterval={heartbeatInterval} />
              <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
              <MetricChart label="Heap" unit=" MB" dataKey="heap" history={history} color="var(--peach)" height={100} heartbeatInterval={heartbeatInterval} />
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              <MetricChart label="Workers" unit="" dataKey="workers" history={history} color="var(--violet)" height={70} heartbeatInterval={heartbeatInterval} />
              <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
              <MetricChart label="Active Jobs" unit="" dataKey="activeJobs" history={history} color="var(--teal)" height={70} heartbeatInterval={heartbeatInterval} />
              <div style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {pm.recordedAt && <span>updated {formatRelative(pm.recordedAt)}</span>}
              {history.length > 0 && <span>{history.length} samples{approxWindowMins !== null ? ` · ~${approxWindowMins}m window` : ''}</span>}
              <span style={{ marginLeft: 'auto' }}>registered {formatDate(runner.createdAt)}</span>
            </div>
          </div>

          {isDisconnected && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <WifiOff size={18} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>No Data</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Runner is {label.toLowerCase()}</span>
            </div>
          )}
          {!isDisconnected && !hasMetrics && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Waiting for first heartbeat with metrics…</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
