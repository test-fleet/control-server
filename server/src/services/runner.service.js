const Runner = require('../models/runner.model')
const { ConflictError, AppError, NotFoundError } = require('../utils/appError')
const { generateApiKey, generateApiSecret, encryptSecret } = require('../utils/crypto')
const { getPublisher } = require('../../config/redis')

const METRICS_CAP = 60
const METRICS_TTL = 3600 // 1 hour
const INSTANCE_STALE_SECS = 60 // remove instance if no heartbeat for this long

function metricsKey(runnerId) {
  return `runner:metrics:${runnerId}`
}

function instancesKey(runnerId) {
  return `runner:instances:${runnerId}`
}

async function createNewRunner(name, userId) {
  const existingRunner = await Runner.findOne({ name: name })
  if (existingRunner) throw new ConflictError('Runner with this name already exists')

  const apiKey = generateApiKey()
  const apiSecret = generateApiSecret()
  const encryptedSecret = await encryptSecret(apiSecret)
  try {
    const runner = await Runner.create({
      name: name,
      createdBy: userId,
      keyId: apiKey,
      encryptedSecret: encryptedSecret
    })
    return {
      id: runner._id,
      name: runner.name,
      apiKey: runner.keyId,
      apiSecret: apiSecret
    }
  } catch (err) {
    console.log(err)
    throw new AppError('failed to create runner', 500)
  }
}

async function listRunners(page, limit) {
  try {
    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 12

    const skip = (pageNum - 1) * limitNum

    const runners = await Runner.find()
      .skip(skip)
      .limit(limitNum)
      .exec()

    const total = await Runner.countDocuments()

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limitNum),
      data: runners
    }
  } catch (err) {
    console.log(err)
    throw new AppError('failed to retrieve runners', 500)
  }
}

async function recordHeartbeat(runnerId, metrics, instanceId, runnerName) {
  const runner = await Runner.findById(runnerId).select('name').lean()
  if (!runner) {
    console.error('runner not found')
    throw new AppError('failed to retrieve runner', 500)
  }

  const update = { lastSeen: new Date() }

  if (metrics) {
    update.performanceMetrics = {
      cpuPercent:  metrics.cpuPercent  ?? null,
      memUsedMb:   metrics.memUsedMb   ?? null,
      heapAllocMb: metrics.heapAllocMb ?? null,
      workers:     metrics.workers     ?? null,
      activeJobs:  metrics.activeJobs  ?? null,
      recordedAt:  new Date(),
    }

    const entry = JSON.stringify({
      time:       new Date().toISOString(),
      cpu:        metrics.cpuPercent  ?? null,
      mem:        metrics.memUsedMb   ?? null,
      heap:       metrics.heapAllocMb ?? null,
      workers:    metrics.workers     ?? null,
      activeJobs: metrics.activeJobs  ?? null,
    })

    try {
      const client = getPublisher()
      const key = metricsKey(runnerId)
      await client.lPush(key, entry)
      await client.lTrim(key, 0, METRICS_CAP - 1)
      await client.expire(key, METRICS_TTL)
    } catch (err) {
      console.error('[runner] failed to push metrics to redis:', err)
    }
  }

  if (instanceId) {
    try {
      const client = getPublisher()
      const key = instancesKey(runnerId)
      const nowSecs = Math.floor(Date.now() / 1000)
      const member = runnerName ? `${instanceId}|${runnerName}` : instanceId
      await client.zAdd(key, [{ score: nowSecs, value: member }])
      await client.zRemRangeByScore(key, '-inf', nowSecs - INSTANCE_STALE_SECS)
      const members = await client.zRange(key, 0, -1)
      update.multipleInstances = members.length > 1
      update.credentialBorrowers = [...new Set(
        members
          .map(m => m.split('|')[1])
          .filter(name => name && name !== runner.name)
      )]
    } catch (err) {
      console.error('[runner] failed to track instance in redis:', err)
    }
  }

  try {
    await Runner.findByIdAndUpdate(runnerId, { $set: update })
  } catch (err) {
    console.error(err)
    throw new AppError('failed to update runner heartbeat', 500)
  }
}

async function getRunnerMetrics(runnerId) {
  try {
    const client = getPublisher()
    const raw = await client.lRange(metricsKey(runnerId), 0, -1)
    // lPush inserts newest first; reverse to get chronological order for charts
    return raw.map(s => JSON.parse(s)).reverse()
  } catch (err) {
    console.error('[runner] failed to get metrics from redis:', err)
    return []
  }
}

async function updateRunner(runnerId, updates) {
  const runner = await Runner.findById(runnerId)
  if (!runner) throw new NotFoundError('Runner not found')

  if (updates.name !== undefined) {
    const conflict = await Runner.findOne({ name: updates.name, _id: { $ne: runnerId } })
    if (conflict) throw new ConflictError('Runner with this name already exists')
    runner.name = updates.name
  }

  if (updates.status !== undefined) {
    runner.status = updates.status
  }

  try {
    await runner.save()
    return { id: runner._id, name: runner.name, status: runner.status }
  } catch (err) {
    console.error(err)
    throw new AppError('failed to update runner', 500)
  }
}

async function deleteRunner(runnerId) {
  const runner = await Runner.findById(runnerId)
  if (!runner) throw new NotFoundError('Runner not found')

  try {
    await Runner.deleteOne({ _id: runnerId })
    try {
      const client = getPublisher()
      await client.del(metricsKey(runnerId))
      await client.del(instancesKey(runnerId))
    } catch (err) {
      console.error('[runner] failed to clean up runner keys:', err)
    }
    return { id: runnerId }
  } catch (err) {
    if (err instanceof NotFoundError) throw err
    console.error(err)
    throw new AppError('failed to delete runner', 500)
  }
}

module.exports = {
  createNewRunner,
  listRunners,
  recordHeartbeat,
  getRunnerMetrics,
  updateRunner,
  deleteRunner,
}
