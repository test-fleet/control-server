import { useState, useEffect } from 'react'
import {
  Users, Activity, AlertCircle, Clock, BookOpen, Clapperboard, CheckCircle2, XCircle,
  AlertTriangle, WifiOff, KeyRound, PlayCircle,
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useFleet } from '../context/FleetContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import Badge from '../components/Badge'
import StatTile from '../components/StatTile'
import StatusPulse from '../components/StatusPulse'
import { RunDotTrail } from '../components/Sparkline'
import { statusColor } from '../lib/statusColor'

function timeAgo(date) {
  if (!date) return null
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function runnerDisplayStatus(runner, threshold, isCredentialFlagged = false) {
  if (runner.status === 'disabled') return { variant: 'disabled', label: 'Disabled', color: 'var(--error)' }
  if (isCredentialFlagged) return { variant: 'active-warn', label: 'Active', color: 'var(--warning)' }
  if (!runner.lastSeen) return { variant: 'unresponsive', label: 'No heartbeat', color: 'var(--error)' }
  if (Date.now() - new Date(runner.lastSeen).getTime() > threshold) return { variant: 'unresponsive', label: 'Unresponsive', color: 'var(--error)' }
  return { variant: 'online', label: 'Active', color: 'var(--lime)' }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function queueTimeAgo(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 5_000) return 'just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  return timeAgo(date)
}

function queueLabel(q) {
  if (q.status === 'queued') return 'Queued — waiting for runners to report'
  if (q.status === 'running') return `Running — ${q.reportedRunners}/${q.expectedRunners} reported`
  return `Completed — ${q.reportedRunners}/${q.expectedRunners} reported`
}

function alertIcon(type) {
  if (type === 'runner_offline') return WifiOff
  if (type === 'runner_credentials') return KeyRound
  return AlertTriangle
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, heartbeatInterval } = useAuth()
  const { summary, loading: summaryLoading } = useFleet()
  const threshold = heartbeatInterval * 3

  const [runners, setRunners] = useState(null)
  const [scenes, setScenes] = useState(null)
  const [sceneHistories, setSceneHistories] = useState({})
  const [loading, setLoading] = useState(true)

  function fetchData(showSpinner) {
    if (showSpinner) setLoading(true)
    Promise.allSettled([
      api.get('/runners?limit=100'),
      api.get('/scenes?limit=100'),
    ]).then(([rRes, sRes]) => {
      if (rRes.status === 'fulfilled') setRunners(rRes.value)
      if (sRes.status === 'fulfilled') setScenes(sRes.value)
      if (showSpinner) setLoading(false)
    })
  }

  useEffect(() => { fetchData(true) }, []) // eslint-disable-line
  useAutoRefresh(() => fetchData(false), heartbeatInterval)

  const sceneList = scenes?.data || []
  const runnerList = runners?.data || []

  // Batched fetch of recent-run history for the dot-trail column — fine at
  // the fleet sizes this product targets (one runner deployment per identity,
  // a modest scene count), avoids a bulk-history backend endpoint.
  useEffect(() => {
    const topScenes = sceneList.slice(0, 12)
    if (topScenes.length === 0) return
    Promise.allSettled(topScenes.map(s => api.get(`/results/scene/${s.id}/summary`)))
      .then(results => {
        const map = {}
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') map[topScenes[i].id] = (r.value.recentRuns || []).map(run => run.status)
        })
        setSceneHistories(map)
      })
  }, [scenes]) // eslint-disable-line

  const borrowedRunnerNames = new Set(runnerList.flatMap(r => r.credentialBorrowers || []))
  const isCredentialFlagged = (r) => r.multipleInstances || borrowedRunnerNames.has(r.name)

  const isLoading = loading || summaryLoading

  return (
    <>
      <div className="page-header grid-texture">
        <div>
          <h1 className="page-title">
            Good {getGreeting()},{' '}
            {user?.userName?.split(' ')[0] || user?.email?.split('@')[0] || 'there'}
          </h1>
          <p className="page-subtitle">Fleet overview — {summary?.runners.total ?? '…'} runners, {summary?.scenes.total ?? '…'} scenes.</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a href="/api/v1/docs" target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm" style={{ gap: 6, textDecoration: 'none' }}>
            <BookOpen size={13} />
            API Docs
          </a>
        </div>
      </div>

      <div className="page-body">
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner--lg" />
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <StatTile icon={CheckCircle2} variant="success" value={summary?.scenes.passing ?? 0} label="Passing" />
              <StatTile icon={XCircle} variant="error" value={summary?.scenes.failing ?? 0} label="Failing" />
              <StatTile icon={Clapperboard} variant="primary" value={summary?.scenes.enabled ?? 0} label="Active Scenes" />
              <StatTile icon={Activity} variant="success" value={summary?.runners.active ?? 0} label="Active Runners" />
              <StatTile icon={AlertCircle} variant="warning" value={summary?.runners.offline ?? 0} label="Runner Issues" />
              <StatTile icon={Users} variant="peach" value={summary?.users.total ?? 0} label="Team Members" />
            </div>

            {summary?.queue?.length > 0 && (
              <>
                <div className="section-header">
                  <span className="section-title"><PlayCircle size={11} />Queue</span>
                </div>
                <div className="alerts-panel">
                  {summary.queue.map(q => {
                    const live = q.status !== 'completed'
                    const color = live ? 'var(--blue)' : 'var(--lime)'
                    const target = q.reportedRunners > 0 ? `/runs/${q.runId}` : `/scenes/${q.sceneId}`
                    return (
                      <div key={q.runId} className="alert-row" style={{ borderLeftColor: color }} onClick={() => navigate(target)}>
                        <span className="alert-row-icon">
                          <StatusPulse color={color} live={live} size={9} />
                        </span>
                        <div className="alert-row-body">
                          <div className="alert-row-title">{q.sceneName}</div>
                          <div className="alert-row-sub">{queueLabel(q)} · {queueTimeAgo(q.dispatchedAt)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {summary?.alerts?.length > 0 && (
              <>
                <div className="section-header">
                  <span className="section-title"><AlertTriangle size={11} />Alerts</span>
                </div>
                <div className="alerts-panel">
                  {summary.alerts.slice(0, 5).map((a, i) => {
                    const Icon = alertIcon(a.type)
                    return (
                      <div key={i} className={`alert-row alert-row--${a.severity}`} onClick={() => navigate(a.path)}>
                        <span className="alert-row-icon" style={{ color: a.severity === 'error' ? 'var(--error)' : 'var(--warning)' }}>
                          <Icon size={14} />
                        </span>
                        <div className="alert-row-body">
                          <div className="alert-row-title">{a.title}</div>
                          {a.sub && <div className="alert-row-sub">{a.sub}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <div className="section-header">
              <span className="section-title">Scene Health</span>
              <Link to="/scenes" className="btn btn--ghost btn--sm" style={{ textDecoration: 'none' }}>Manage</Link>
            </div>
            {sceneList.length === 0 ? (
              <div className="table-wrap" style={{ marginBottom: 20 }}>
                <div className="table-empty">No scenes configured.</div>
              </div>
            ) : (
              <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 20 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)', zIndex: 1 }}>Scene</th>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)', zIndex: 1 }}>Recent</th>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)', zIndex: 1 }}>Last Run</th>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)', zIndex: 1 }}>Last Pass</th>
                      <th style={{ position: 'sticky', top: 0, background: 'var(--surface-raised)', zIndex: 1 }}>Last Fail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sceneList.map(scene => (
                      <tr key={scene.id} onClick={() => navigate(`/scenes/${scene.id}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: statusColor(scene.lastRunStatus) }} />
                            <div>
                              <div style={{ fontWeight: 500, color: scene.enabled ? 'var(--text)' : 'var(--text-muted)' }}>{scene.name}</div>
                              {!scene.enabled && <div className="monospace text-muted" style={{ fontSize: 10 }}>disabled</div>}
                            </div>
                          </div>
                        </td>
                        <td><RunDotTrail runs={sceneHistories[scene.id] || []} /></td>
                        <td>
                          {scene.lastRunStatus ? (
                            <div>
                              <div className="monospace" style={{ fontSize: 11, fontWeight: 600, color: statusColor(scene.lastRunStatus) }}>{scene.lastRunStatus}</div>
                              <div className="monospace text-muted" style={{ fontSize: 10, marginTop: 1 }}>{timeAgo(scene.lastRunAt)}</div>
                            </div>
                          ) : (
                            <span className="monospace text-muted" style={{ fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className="monospace" style={{ fontSize: 11, color: scene.lastPassAt ? 'var(--success)' : 'var(--text-muted)' }}>
                            {scene.lastPassAt ? timeAgo(scene.lastPassAt) : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="monospace" style={{ fontSize: 11, color: scene.lastFailAt ? 'var(--error)' : 'var(--text-muted)' }}>
                            {scene.lastFailAt ? timeAgo(scene.lastFailAt) : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {runnerList.length > 0 && (
              <>
                <div className="section-header">
                  <span className="section-title">Runner Status</span>
                  <Link to="/runners" className="btn btn--ghost btn--sm" style={{ textDecoration: 'none' }}>View all</Link>
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
                        const { variant, label, color } = runnerDisplayStatus(runner, threshold, flagged)
                        const isLive = variant === 'online'
                        return (
                          <tr key={runner._id} onClick={() => navigate(`/runners/${runner._id}`)} style={{ cursor: 'pointer', borderLeft: flagged ? '3px solid var(--warning)' : undefined }}>
                            <td><div style={{ fontWeight: 500 }}>{runner.name}</div></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <StatusPulse color={color} live={isLive} />
                                <Badge variant={variant}>{label}</Badge>
                              </div>
                            </td>
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
