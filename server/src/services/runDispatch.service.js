const RunDispatch = require('../models/runDispatch.model')

const EXPIRY_GRACE_MS = 60 * 60 * 1000 // 1hr past deadline — plenty of time for the sweep to visit it first

async function recordDispatch({ runId, sceneId, sceneName, expectedRunners, dispatchedAt, timeoutMs }) {
  const deadline = new Date(dispatchedAt.getTime() + timeoutMs)
  const expiresAt = new Date(deadline.getTime() + EXPIRY_GRACE_MS)
  return RunDispatch.create({ runId, sceneId, sceneName, expectedRunners, dispatchedAt, deadline, expiresAt })
}

async function getExpectedRunners(runId) {
  const dispatch = await RunDispatch.findOne({ runId }).select('expectedRunners').lean()
  return dispatch?.expectedRunners ?? null
}

async function listRecentDispatches(limit = 8) {
  return RunDispatch.find().sort({ dispatchedAt: -1 }).limit(limit).lean()
}

// Atomically claims overdue, unresolved dispatches so a sweep tick can never
// process the same dispatch twice (the resolved:false->true flip is the
// mutex, not a read-then-write count check).
async function claimOverdue() {
  const candidates = await RunDispatch.find({ resolved: false, deadline: { $lte: new Date() } }).lean()

  const claimed = []
  for (const candidate of candidates) {
    const result = await RunDispatch.findOneAndUpdate(
      { _id: candidate._id, resolved: false },
      { $set: { resolved: true } }
    )
    if (result) claimed.push(candidate)
  }
  return claimed
}

module.exports = { recordDispatch, getExpectedRunners, listRecentDispatches, claimOverdue }
