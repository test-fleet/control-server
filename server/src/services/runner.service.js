const Runner = require('../models/runner.model')
const { ConflictError, AppError } = require('../utils/appError')
const { generateApiKey, generateApiSecret, encryptSecret } = require('../utils/crypto')

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
  }

  try {
    await runner.save()
  } catch (err) {
    console.error(err)
    throw new AppError('failed to update runner heartbeat', 500)
  }
}

module.exports = {
  createNewRunner,
  listRunners,
  recordHeartbeat
}