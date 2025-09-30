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

  try {
    await runnerService.recordHeartbeat(id)
    res.status(204).json({
      "success": true
    });
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

module.exports = {
  createRunner,
  listRunners,
  runnerHeartbeat
}