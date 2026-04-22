import { useState, useEffect } from 'react'
import { Server, Users, Activity, AlertCircle, Clock, BookOpen, Clapperboard, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import Badge from '../components/Badge'

function timeAgo(date) {
  if (!date) return null
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusColor(s) {
  if (s === 'passed') return 'var(--success)'
  if (s === 'error')  return 'var(--peach)'
  if (s === 'failed') return 'var(--error)'
  return 'var(--border-bright)'
}

const FREQUENCY_OPTIONS = [
  { label: '1m',   value: 1    },
  { label: '5m',   value: 5    },
  { label: '10m',  value: 10   },
  { label: '15m',  value: 15   },
  { label: '30m',  value: 30   },
  { label: '1h',   value: 60   },
  { label: '3h',   value: 180  },
  { label: '6h',   value: 360  },
  { label: '12h',  value: 720  },
  { label: '24h',  value: 1440 },
]

function detectFrequencyMs(cron) {
  if (!cron) return null
  if (cron.trim() === '* * * * *') return 60_000
  const step = parseInt(cron.split('/')[1])
  return isNaN(step) ? null : step * 60_000
}

function freqLabel(cron) {
  if (!cron) return '—'
  if (cron.trim() === '* * * * *') return 'every 1m'
  const step = parseInt(cron.split('/')[1])
  const match = FREQUENCY_OPTIONS.find(o => o.value === step)
  return match ? `every ${match.label}` : cron
}

function nextRunLabel(scene) {
  const { lastRunAt, cronSchedule } = scene
  const intervalMs = detectFrequencyMs(cronSchedule)
  if (!intervalMs) return '—'
  const base = lastRunAt ? new Date(lastRunAt).getTime() : Date.now() - intervalMs
  const next = base + intervalMs
  const diff = next - Date.now()
  if (diff <= 0) return 'due now'
  if (diff < 60_000) return `in ${Math.ceil(diff / 1000)}s`
  return `in ${Math.ceil(diff / 60_000)}m`
}

function runnerDisplayStatus(runner, threshold) {
  if (runner.status === 'disabled') return { variant: 'disabled', label: 'Disabled' }
  if (!runner.lastSeen) return { variant: 'unresponsive', label: 'No heartbeat' }
  if (Date.now() - new Date(runner.lastSeen).getTime() > threshold) return { variant: 'unresponsive', label: 'Unresponsive' }
  return { variant: 'online', label: 'Active' }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export default function Dashboard() {
  const { user, heartbeatInterval } = useAuth()
  const threshold = heartbeatInterval * 3

  const [runners, setRunners] = useState(null)
  const [users, setUsers] = useState(null)
  const [scenes, setScenes] = useState(null)
  const [recentRuns, setRecentRuns] = useState([])
  const [loading, setLoading] = useState(true)

  function fetchData(showSpinner) {
    if (showSpinner) setLoading(true)
    Promise.allSettled([
      api.get('/runners?limit=100'),
      api.get('/users?limit=100'),
      api.get('/scenes?limit=100'),
      api.get('/results/recent?limit=6'),
    ]).then(([rRes, uRes, sRes, runsRes]) => {
      if (rRes.status === 'fulfilled') setRunners(rRes.value)
      if (uRes.status === 'fulfilled') setUsers(uRes.value)
      if (sRes.status === 'fulfilled') setScenes(sRes.value)
      if (runsRes.status === 'fulfilled') setRecentRuns(runsRes.value.data || [])
      if (showSpinner) setLoading(false)
    })
  }

  useEffect(() => { fetchData(true) }, []) // eslint-disable-line
  useAutoRefresh(() => fetchData(false), heartbeatInterval)

  const runnerList  = runners?.data || []
  const sceneList   = scenes?.data  || []
  const activeRunners  = runnerList.filter(r => r.lastSeen && r.status !== 'disabled' && Date.now() - new Date(r.lastSeen).getTime() <= threshold).length
  const problemRunners = runnerList.filter(r => r.status === 'disabled' || !r.lastSeen || Date.now() - new Date(r.lastSeen).getTime() > threshold).length
  const passingScenes  = sceneList.filter(s => s.lastRunStatus === 'passed').length
  const failingScenes  = sceneList.filter(s => s.lastRunStatus === 'failed' || s.lastRunStatus === 'error').length
  const enabledScenes  = sceneList.filter(s => s.enabled).length

  const CARD = {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: 6,
  }

  const SECTION_LABEL = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace',
    marginBottom: 10,
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Good {getGreeting()},{' '}
            {user?.userName?.split(' ')[0] || user?.email?.split('@')[0] || 'there'}
          </h1>
          <p className="page-subtitle">Here's what's happening with your test fleet.</p>
        </div>
        <a
          href="/api/v1/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--ghost btn--sm"
          style={{ marginLeft: 'auto', gap: 6, textDecoration: 'none' }}
        >
          <BookOpen size={13} />
          API Docs
        </a>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner--lg" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon stat-icon--success"><CheckCircle2 size={16} /></div>
                <div className="stat-value">{passingScenes}</div>
                <div className="stat-label">Passing</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon--error" style={{ background: 'var(--error-bg)' }}>
                  <XCircle size={16} style={{ color: 'var(--error)' }} />
                </div>
                <div className="stat-value">{failingScenes}</div>
                <div className="stat-label">Failing</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon--primary"><Clapperboard size={16} /></div>
                <div className="stat-value">{enabledScenes}</div>
                <div className="stat-label">Active Scenes</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon--success"><Activity size={16} /></div>
                <div className="stat-value">{activeRunners}</div>
                <div className="stat-label">Active Runners</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon--warning"><AlertCircle size={16} /></div>
                <div className="stat-value">{problemRunners}</div>
                <div className="stat-label">Runner Issues</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon--peach"><Users size={16} /></div>
                <div className="stat-value">{users?.total ?? 0}</div>
                <div className="stat-label">Team Members</div>
              </div>
            </div>

            {/* Two-column: scene health + recent runs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

              {/* Scene health */}
              <div style={CARD}>
                <div style={{ padding: '14px 16px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ ...SECTION_LABEL, marginBottom: 0 }}>Scene Schedule</span>
                    <a href="/scenes" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>manage →</a>
                  </div>
                </div>
                {sceneList.length === 0 ? (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    No scenes configured.
                  </div>
                ) : (
                  <div style={{ padding: '0 0 8px' }}>
                    {sceneList.slice(0, 10).map(scene => (
                      <div
                        key={scene.id || scene._id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 16px',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: statusColor(scene.lastRunStatus) }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: scene.enabled ? 'var(--text)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {scene.name}
                          </div>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 1 }}>
                            {freqLabel(scene.cronSchedule)}
                            {scene.lastRunAt && <span> · {timeAgo(scene.lastRunAt)}</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
                          {scene.enabled ? nextRunLabel(scene) : 'disabled'}
                        </div>
                      </div>
                    ))}
                    {sceneList.length > 10 && (
                      <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)' }}>
                        +{sceneList.length - 10} more
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recent runs */}
              <div style={CARD}>
                <div style={{ padding: '14px 16px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ ...SECTION_LABEL, marginBottom: 0 }}>Recent Runs</span>
                    <a href="/runs" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>view all →</a>
                  </div>
                </div>
                {recentRuns.length === 0 ? (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    No runs yet.
                  </div>
                ) : (
                  <div style={{ padding: '0 0 8px' }}>
                    {recentRuns.map(run => (
                      <div
                        key={run.runId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 16px',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: statusColor(run.status) }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {run.sceneName}
                          </div>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 1 }}>
                            {run.durationMs}ms
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {timeAgo(run.completedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Runner status */}
            {runnerList.length > 0 && (
              <>
                <div className="section-header">
                  <span className="section-title">Runner Status</span>
                  <a href="/runners" className="btn btn--ghost btn--sm" style={{ textDecoration: 'none' }}>View all</a>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Runner</th>
                        <th>Status</th>
                        <th>Last Seen</th>
                        <th>Key</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runnerList.slice(0, 6).map(runner => {
                        const { variant, label } = runnerDisplayStatus(runner, threshold)
                        return (
                          <tr key={runner._id}>
                            <td><div style={{ fontWeight: 500 }}>{runner.name}</div></td>
                            <td><Badge variant={variant}>{label}</Badge></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                                <Clock size={12} />
                                {timeAgo(runner.lastSeen) ?? 'Never'}
                              </div>
                            </td>
                            <td><span className="monospace text-muted" style={{ fontSize: 11 }}>{runner.keyId}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
