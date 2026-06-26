const { ROLES } = require('../utils/constants')
const { UnauthorizedError, ValidationError } = require('../utils/appError')
const runnerService = require('../services/runner.service')

async function createRunner(req, res, next) {
  const userRole = req.user.role
  if (userRole !== ROLES.ADMIN) {
    return next(new UnauthorizedError('You must be an admin to create runners'))
  }

  const userId = req.user.id
  const runnerName = req.body.name
  if (!runnerName) {
    return next(new ValidationError('no name provided in json body'))
  }

  try {
    const runner = await runnerService.createNewRunner(runnerName, userId)
    res.status(201).json({
      message: 'This API secret is shown only once. Make sure to save it securely now.',
      ...runner
    })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function listRunners(req, res, next) {
  try {
    const {page, limit } = req.query
    const result = await runnerService.listRunners(page, limit)

    res.status(200).json({
      success: true,
      ...result
    })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function runnerHeartbeat(req, res, next) {
  const { id } = req.runner
  const instanceId = req.headers['x-instance-id'] || null
  const runnerName = req.headers['x-runner-name'] || null
  const performanceMetrics = {
    cpuPercent:  req.body.cpu_percent,
    memUsedMb:   req.body.mem_used_mb,
    heapAllocMb: req.body.heap_alloc_mb,
    workers:     req.body.goroutines,
    activeJobs:  req.body.active_jobs,
  }

  try {
    await runnerService.recordHeartbeat(id, performanceMetrics, instanceId, runnerName)
    res.status(204).json({
      "success": true
    });
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function runnerMetrics(req, res, next) {
  const { id } = req.params
  try {
    const metrics = await runnerService.getRunnerMetrics(id)
    res.json({ success: true, metrics })
  } catch (err) {
    console.error(err)
    return next(err)
  }
}

async function updateRunner(req, res, next) {
  if (req.user.role !== ROLES.ADMIN) {
    return next(new UnauthorizedError('You must be an admin to update runners'))
  }

  const { id } = req.params
  const { name, status } = req.body

  if (name !== undefined && !name.trim()) {
    return next(new ValidationError('name cannot be empty'))
  }

  const VALID_STATUSES = ['active', 'disabled']
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return next(new ValidationError(`status must be one of: ${VALID_STATUSES.join(', ')}`))
  }

  const updates = {}
  if (name !== undefined) updates.name = name.trim()
  if (status !== undefined) updates.status = status

  try {
    const result = await runnerService.updateRunner(id, updates)
    res.status(200).json({ message: 'Runner updated', ...result })
  } catch (err) {
    console.error(err)
    return next(err)
  }
}

async function deleteRunner(req, res, next) {
  if (req.user.role !== ROLES.ADMIN) {
    return next(new UnauthorizedError('You must be an admin to delete runners'))
  }

  const { id } = req.params
  try {
    const result = await runnerService.deleteRunner(id)
    res.status(200).json({ message: 'Runner deleted', ...result })
  } catch (err) {
    console.error(err)
    return next(err)
  }
}

module.exports = {
  createRunner,
  listRunners,
  runnerHeartbeat,
  runnerMetrics,
  updateRunner,
  deleteRunner,
}