import { useState, useEffect } from 'react'
import { Cpu, MemoryStick, Timer, Gauge, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

function formatUptime(s) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

function formatBytes(b) {
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(2)} GB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function MetricRow({ label, value, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="monospace" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span className="monospace" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{value}</span>
        {sub && <span className="monospace" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{sub}</span>}
      </div>
    </div>
  )
}

function MemBar({ used, total, color }) {
  const pct = Math.round((used / total) * 100)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="monospace" style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{formatBytes(used)}</span>
        <span className="monospace" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}% of {formatBytes(total)}</span>
      </div>
      <div className="progress-track" style={{ height: 4 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function System() {
  const { heartbeatInterval } = useAuth()
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  function load(showSpinner) {
    if (showSpinner) setLoading(true)
    api.get('/metrics')
      .then(data => {
        setMetrics(data)
        setLastUpdated(new Date())
      })
      .catch(() => {})
      .finally(() => { if (showSpinner) setLoading(false) })
  }

  useEffect(() => { load(true) }, []) // eslint-disable-line
  useAutoRefresh(() => load(false), heartbeatInterval)

  const heapPct = metrics ? Math.round((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100) : 0
  const sysPct = metrics ? Math.round(((metrics.system.totalMem - metrics.system.freeMem) / metrics.system.totalMem) * 100) : 0
  const heapColor = heapPct > 80 ? 'var(--error)' : heapPct > 60 ? 'var(--warning)' : 'var(--lime)'
  const sysColor = sysPct > 85 ? 'var(--error)' : sysPct > 70 ? 'var(--warning)' : 'var(--blue)'

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">System</h1>
          <p className="page-subtitle">
            Control server process metrics
            {lastUpdated && (
              <span style={{ marginLeft: 8 }}>
                · updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button className="btn btn--secondary btn--sm" onClick={() => load(false)}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner--lg" />
          </div>
        ) : !metrics ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            Could not load metrics.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>

            {/* Process */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Timer size={13} style={{ color: 'var(--blue)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>Process</span>
              </div>
              <MetricRow label="Uptime"   value={formatUptime(metrics.uptime)} />
              <MetricRow label="Node"     value={metrics.node} />
              <MetricRow label="Platform" value={metrics.platform} />
              <MetricRow label="Load avg" value={metrics.system.loadAvg1} sub="1 min" />
            </div>

            {/* Heap memory */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Cpu size={13} style={{ color: 'var(--lime)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>Heap Memory</span>
              </div>
              <MemBar used={metrics.memory.heapUsed} total={metrics.memory.heapTotal} color={heapColor} />
              <div style={{ marginTop: 2 }}>
                <MetricRow label="Used"  value={formatBytes(metrics.memory.heapUsed)} />
                <MetricRow label="Total" value={formatBytes(metrics.memory.heapTotal)} />
                <MetricRow label="RSS"   value={formatBytes(metrics.memory.rss)} sub="resident set" />
              </div>
            </div>

            {/* System memory */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <MemoryStick size={13} style={{ color: 'var(--blue)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>System Memory</span>
              </div>
              <MemBar used={metrics.system.totalMem - metrics.system.freeMem} total={metrics.system.totalMem} color={sysColor} />
              <div style={{ marginTop: 2 }}>
                <MetricRow label="Used"  value={formatBytes(metrics.system.totalMem - metrics.system.freeMem)} />
                <MetricRow label="Free"  value={formatBytes(metrics.system.freeMem)} />
                <MetricRow label="Total" value={formatBytes(metrics.system.totalMem)} />
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  )
}
