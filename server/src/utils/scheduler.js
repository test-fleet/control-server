const cron = require('node-cron')
const crypto = require('crypto')
const Scene = require('../models/scene.model')
const Frame = require('../models/frame.model')
const { getPublisher } = require('../../config/redis')

// sceneId -> cron.ScheduledTask
const jobs = new Map()

async function reload() {
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

  const frames = await Frame.find({ sceneId, enabled: true }).sort({ order: 1 })

  const payload = _buildPayload(scene, frames)
  const channel = process.env.REDIS_CHANNEL || 'testfleet:jobs'

  await getPublisher().publish(channel, JSON.stringify(payload))
  console.log(`[scheduler] published ${payload.jobId} for scene ${scene.id}`)
}

function _buildPayload(scene, frames) {
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

module.exports = { reload }
