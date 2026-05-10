const Runner = require('../models/runner.model')
const { ConflictError, AppError } = require('../utils/appError')
const { generateApiKey, generateApiSecret, encryptSecret } = require('../utils/crypto')
const { getPublisher } = require('../../config/redis')

const METRICS_CAP = 60
const METRICS_TTL = 3600 // 1 hour

function metricsKey(runnerId) {
  return `runner:metrics:${runnerId}`
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

async function recordHeartbeat(runnerId, metrics) {
  const runner = await Runner.findById(runnerId)
  if (!runner) {
    console.error('runner not found')
    throw new AppError('failed to retrieve runner', 500)
  }

  runner.lastSeen = new Date()

  if (metrics) {
    runner.performanceMetrics = {
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

  try {
    await runner.save()
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

module.exports = {
  createNewRunner,
  listRunners,
  recordHeartbeat,
  getRunnerMetrics,
}
