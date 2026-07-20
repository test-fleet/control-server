const cron = require('node-cron')
const crypto = require('crypto')
const Scene = require('../models/scene.model')
const Frame = require('../models/frame.model')
const Runner = require('../models/runner.model')
const { getPublisher } = require('../../config/redis')
const { setJobExpectedRunners } = require('./jobCache')
const { recordDispatch } = require('./dispatchTracker')
const { REDIS_CHANNEL } = require('./constants')

// sceneId -> cron.ScheduledTask
const jobs = new Map()

// Mutex: only one reload may execute at a time.
// If reload() is called while one is in-flight, _pendingReload is set so
// a second pass runs immediately after, capturing any changes made during
// the first pass.
let _reloading = false
let _pendingReload = false

async function reload() {
  if (_reloading) {
    _pendingReload = true
    return
  }

  _reloading = true
  _pendingReload = false

  try {
    for (const task of jobs.values()) {
      task.stop()
    }
    jobs.clear()

    let scenes
    try {
      scenes = await Scene.find({ enabled: true })
    } catch (err) {
      console.error('[scheduler] failed to load scenes:', err)
      return
    }

    for (const scene of scenes) {
      _register(scene)
    }

    console.log(`[scheduler] ${jobs.size} scene(s) scheduled`)
  } finally {
    _reloading = false
    if (_pendingReload) {
      reload()
    }
  }
}

function _register(scene) {
  if (!cron.validate(scene.cronSchedule)) {
    console.warn(`[scheduler] invalid cron for scene ${scene.id}: "${scene.cronSchedule}"`)
    return
  }

  const task = cron.schedule(scene.cronSchedule, async () => {
    try {
      await _fireJob(scene.id)
    } catch (err) {
      console.error(`[scheduler] job fire failed for scene ${scene.id}:`, err)
    }
  })

  jobs.set(scene.id, task)
}

async function _fireJob(sceneId) {
  const scene = await Scene.findOne({ id: sceneId, enabled: true })
  if (!scene) return

  const [frames, expectedRunners] = await Promise.all([
    Frame.find({ sceneId, enabled: true }).sort({ order: 1 }),
    Runner.countDocuments({ status: 'active' }),
  ])

  if (frames.length === 0) {
    console.warn(`[scheduler] skipping scene ${scene.id}: no enabled frames`)
    return
  }

  const payload = _buildPayload(scene, frames, expectedRunners)

  setJobExpectedRunners(payload.runId, expectedRunners)
  recordDispatch({ runId: payload.runId, sceneId: scene.id, sceneName: scene.name, expectedRunners })
  await getPublisher().publish(REDIS_CHANNEL, JSON.stringify(payload))
  console.log(`[scheduler] published ${payload.jobId} for scene ${scene.id} (${expectedRunners} active runner(s))`)
}

function _buildPayload(scene, frames, expectedRunners = 1) {
  const now = new Date().toISOString()

  const variables = {}
  if (scene.variables) {
    for (const [k, v] of scene.variables) {
      variables[k] = { type: v.type, value: v.value }
    }
  }

  return {
    jobId: `job_${crypto.randomUUID()}`,
    type: 'scene',
    runId: `run_${crypto.randomUUID()}`,
    expectedRunners,
    createdAt: now,
    scene: {
      id: scene.id,
      name: scene.name,
      description: scene.description || '',
      variables,
      frameIds: scene.frameIds || [],
      timeout: scene.timeout,
      orgId: scene.orgId,
      cronSchedule: scene.cronSchedule,
      enabled: scene.enabled,
      createdBy: scene.createdBy,
      createdAt: scene.createdAt?.toISOString() ?? now,
      updatedAt: scene.updatedAt?.toISOString() ?? now,
    },
    frames: frames.map(f => ({
      id: f._id.toString(),
      frameId: f._id.toString(),
      sceneId: f.sceneId,
      name: f.name,
      order: f.order,
      timeout: f.request?.timeout ?? 30000,
      enabled: f.enabled,
      request: {
        method: f.request.method,
        url: f.request.url,
        headers: Object.fromEntries(f.request.headers ?? new Map()),
        body: f.request.body || '',
      },
      extractors: (f.extractors ?? []).map(e => ({
        name: e.name,
        type: e.type,
        source: e.source,
        dataType: e.dataType,
      })),
      assertions: (f.assertions ?? []).map(a => ({
        type: a.type === 'json' ? 'body' : a.type,
        operator: a.operator,
        expected: a.expected,
        source: a.source,
      })),
      createdAt: f.createdAt?.toISOString() ?? now,
      updatedAt: f.updatedAt?.toISOString() ?? now,
    })),
  }
}

async function fireJobNow(sceneId) {
  const scene = await Scene.findOne({ id: sceneId })
  if (!scene) throw new Error(`Scene not found: ${sceneId}`)

  const [frames, expectedRunners] = await Promise.all([
    Frame.find({ sceneId, enabled: true }).sort({ order: 1 }),
    Runner.countDocuments({ status: 'active' }),
  ])

  if (frames.length === 0) {
    throw new Error(`Scene ${sceneId} has no enabled frames — nothing to run`)
  }

  const payload = _buildPayload(scene, frames, expectedRunners)

  setJobExpectedRunners(payload.runId, expectedRunners)
  recordDispatch({ runId: payload.runId, sceneId: scene.id, sceneName: scene.name, expectedRunners })
  await getPublisher().publish(REDIS_CHANNEL, JSON.stringify(payload))
  console.log(`[scheduler] manual trigger: published ${payload.jobId} for scene ${scene.id} (${expectedRunners} runner(s))`)
  return { runId: payload.runId, jobId: payload.jobId, expectedRunners }
}

module.exports = { reload, fireJobNow, _buildPayload }
