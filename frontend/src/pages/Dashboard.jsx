import { useState, useEffect } from 'react'
import { Users, Activity, AlertCircle, Clock, BookOpen, Clapperboard, CheckCircle2, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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

function runnerDisplayStatus(runner, threshold, isCredentialFlagged = false) {
  if (runner.status === 'disabled') return { variant: 'disabled', label: 'Disabled' }
  if (isCredentialFlagged) return { variant: 'active-warn', label: 'Active' }
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
  const navigate = useNavigate()
  const { user, heartbeatInterval } = useAuth()
  const threshold = heartbeatInterval * 3

  const [runners, setRunners] = useState(null)
  const [users,   setUsers]   = useState(null)
  const [scenes,  setScenes]  = useState(null)
  const [loading, setLoading] = useState(true)

  function fetchData(showSpinner) {
    if (showSpinner) setLoading(true)
    Promise.allSettled([
      api.get('/runners?limit=100'),
      api.get('/users?limit=100'),
      api.get('/scenes?limit=200'),
    ]).then(([rRes, uRes, sRes]) => {
      if (rRes.status === 'fulfilled') setRunners(rRes.value)
      if (uRes.status === 'fulfilled') setUsers(uRes.value)
      if (sRes.status === 'fulfilled') setScenes(sRes.value)
      if (showSpinner) setLoading(false)
    })
  }

  useEffect(() => { fetchData(true) }, []) // eslint-disable-line
  useAutoRefresh(() => fetchData(false), heartbeatInterval)

  const runnerList        = runners?.data || []
  const borrowedRunnerNames = new Set(runnerList.flatMap(r => r.credentialBorrowers || []))
  const isCredentialFlagged = (r) => r.multipleInstances || borrowedRunnerNames.has(r.name)
  const sceneList      = scenes?.data  || []
  const activeRunners  = runnerList.filter(r => r.lastSeen && r.status !== 'disabled' && Date.now() - new Date(r.lastSeen).getTime() <= threshold).length
  const problemRunners = runnerList.filter(r => r.status === 'disabled' || !r.lastSeen || Date.now() - new Date(r.lastSeen).getTime() > threshold).length
  const passingScenes  = sceneList.filter(s => s.lastRunStatus === 'passed').length
  const failingScenes  = sceneList.filter(s => s.lastRunStatus === 'failed' || s.lastRunStatus === 'error').length
  const enabledScenes  = sceneList.filter(s => s.enabled).length

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
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-icon stat-icon--success"><CheckCircle2 size={16} /></div>
                <div className="stat-value">{passingScenes}</div>
                <div className="stat-label">Passing</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon--error"><XCircle size={16} /></div>
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

            {/* Scene health */}
            <div className="section-header">
              <span className="section-title">Scene Health</span>
              <a href="/scenes" className="btn btn--ghost btn--sm" style={{ textDecoration: 'none' }}>Manage</a>
            </div>
            {sceneList.length === 0 ? (
              <div className="table-wrap" style={{ marginBottom: 20 }}>
                <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No scenes configured.
                </div>
              </div>
            ) : (
              <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 20 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)', zIndex: 1 }}>Scene</th>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)', zIndex: 1 }}>Last Run</th>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)', zIndex: 1 }}>Last Pass</th>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)', zIndex: 1 }}>Last Fail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sceneList.map(scene => (
                      <tr key={scene.id || scene._id} onClick={() => navigate('/scenes')} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                              background: statusColor(scene.lastRunStatus),
                            }} />
                            <div>
                              <div style={{ fontWeight: 500, color: scene.enabled ? 'var(--text)' : 'var(--text-muted)' }}>
                                {scene.name}
                              </div>
                              {!scene.enabled && (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>disabled</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {scene.lastRunStatus ? (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'monospace', color: statusColor(scene.lastRunStatus) }}>
                                {scene.lastRunStatus}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 1 }}>
                                {timeAgo(scene.lastRunAt)}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: scene.lastPassAt ? 'var(--success)' : 'var(--text-muted)' }}>
                            {scene.lastPassAt ? timeAgo(scene.lastPassAt) : '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: scene.lastFailAt ? 'var(--error)' : 'var(--text-muted)' }}>
                            {scene.lastFailAt ? timeAgo(scene.lastFailAt) : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

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
                        const flagged = isCredentialFlagged(runner)
                        const { variant, label } = runnerDisplayStatus(runner, threshold, flagged)
                        return (
                          <tr key={runner._id} style={{ borderLeft: flagged ? '3px solid var(--warning)' : undefined }}>
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
