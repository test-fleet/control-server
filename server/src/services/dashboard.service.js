const Runner = require('../models/runner.model')
const Scene = require('../models/scene.model')
const User = require('../models/user.model')
const { SceneResult } = require('../models/results.models')
const { listRecentDispatches } = require('../utils/dispatchTracker')

const QUEUE_RECENT_WINDOW_MS = 30 * 1000

function heartbeatThresholdMs() {
  const interval = parseInt(process.env.HEARTBEAT_INTERVAL) || 30000
  return interval * 3
}

function isRunnerUnresponsive(runner, thresholdMs) {
  if (!runner.lastSeen) return true
  return Date.now() - new Date(runner.lastSeen).getTime() > thresholdMs
}

// Mirrors the frontend's dupe-credential heuristic: a runner is flagged if it
// has reported multiple concurrent instances, or another runner's heartbeat
// listed this runner's name as a credential borrower.
function isCredentialFlagged(runner, borrowedNames) {
  return runner.multipleInstances || borrowedNames.has(runner.name)
}

const SEVERITY_RANK = { error: 0, warning: 1 }

// Dispatch is recorded the instant a job is published (before any runner has
// had a chance to report back), so "queued"/"running" is knowable immediately
// — SceneResult docs alone can't show that, since none exist yet at t=0.
async function getQueueActivity() {
  const dispatches = listRecentDispatches()
  if (dispatches.length === 0) return []

  const runIds = dispatches.map(d => d.runId)
  const reportRows = await SceneResult.aggregate([
    { $match: { runId: { $in: runIds } } },
    { $group: { _id: '$runId', reported: { $sum: 1 }, completedAt: { $max: '$completedAt' } } },
  ])
  const reportMap = new Map(reportRows.map(r => [r._id, r]))

  const now = Date.now()
  return dispatches
    .map(d => {
      const report = reportMap.get(d.runId)
      const reported = report?.reported || 0
      const status = reported === 0 ? 'queued' : reported < d.expectedRunners ? 'running' : 'completed'
      return {
        runId: d.runId,
        sceneId: d.sceneId,
        sceneName: d.sceneName,
        expectedRunners: d.expectedRunners,
        reportedRunners: reported,
        status,
        dispatchedAt: d.dispatchedAt,
        completedAt: report?.completedAt ?? null,
      }
    })
    .filter(e => e.status !== 'completed' || now - new Date(e.dispatchedAt).getTime() <= QUEUE_RECENT_WINDOW_MS)
    .slice(0, 8)
}

// Server-computed fleet summary for the dashboard. Exists because the
// frontend previously derived these counts client-side from paginated list
// endpoints (?limit=100/200), which is both wasteful and silently wrong once
// a fleet grows past that page size.
async function getDashboardSummary() {
  const [runners, scenes, userCount, queue] = await Promise.all([
    Runner.find().lean(),
    Scene.find().lean(),
    User.countDocuments(),
    getQueueActivity(),
  ])

  const threshold = heartbeatThresholdMs()
  const borrowedNames = new Set(runners.flatMap(r => r.credentialBorrowers || []))

  let activeRunners = 0
  let offlineRunners = 0
  let flaggedRunners = 0
  const alerts = []

  for (const runner of runners) {
    const unresponsive = runner.status === 'disabled' || isRunnerUnresponsive(runner, threshold)
    const flagged = isCredentialFlagged(runner, borrowedNames)

    if (unresponsive) offlineRunners++
    else activeRunners++
    if (flagged) flaggedRunners++

    if (flagged) {
      alerts.push({
        type: 'runner_credentials',
        severity: 'warning',
        title: `"${runner.name}" is sharing API credentials`,
        sub: 'Multiple processes are authenticating with the same key — per-runner metrics may be inaccurate.',
        path: `/runners/${runner._id}`,
      })
    }
    if (unresponsive && runner.status !== 'disabled') {
      alerts.push({
        type: 'runner_offline',
        severity: 'error',
        title: `"${runner.name}" is unresponsive`,
        sub: runner.lastSeen ? `No heartbeat since ${new Date(runner.lastSeen).toISOString()}` : 'Never reported a heartbeat',
        path: `/runners/${runner._id}`,
      })
    }
  }

  let passingScenes = 0
  let failingScenes = 0
  let enabledScenes = 0

  for (const scene of scenes) {
    if (scene.enabled) enabledScenes++
    if (scene.lastRunStatus === 'passed') passingScenes++
    if (scene.lastRunStatus === 'failed' || scene.lastRunStatus === 'error') {
      failingScenes++
      alerts.push({
        type: 'scene_failing',
        severity: 'error',
        title: `"${scene.name}" is failing`,
        sub: scene.lastRunAt ? `Last run ${new Date(scene.lastRunAt).toISOString()}` : 'No successful run recorded',
        path: `/scenes/${scene.id}`,
      })
    }
  }

  alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  return {
    scenes: { total: scenes.length, enabled: enabledScenes, passing: passingScenes, failing: failingScenes },
    runners: { total: runners.length, active: activeRunners, offline: offlineRunners, flagged: flaggedRunners },
    users: { total: userCount },
    alerts,
    queue,
  }
}

module.exports = { getDashboardSummary }
