const { SceneResult, WEEK_MS } = require('../models/results.models')
const Scene = require('../models/scene.model')
const { AppError, ValidationError } = require('../utils/appError')

// Sets the new doc as the pinned pass-or-fail for its scene, unpinning the previous one.
// MongoDB TTL ignores null expiresAt, so pinned docs live indefinitely.
async function pinLatest(docId, sceneId, statusCategory) {
  const oldPinned = await SceneResult.findOne({
    sceneId,
    status: { $in: statusCategory },
    expiresAt: null,
    _id: { $ne: docId },
  })

  if (oldPinned) {
    const expiresAt = new Date(oldPinned.createdAt.getTime() + WEEK_MS)
    await SceneResult.updateOne({ _id: oldPinned._id }, { $set: { expiresAt } })
  }

  await SceneResult.updateOne({ _id: docId }, { $set: { expiresAt: null } })
}

async function saveSceneResult(payload) {
  const { runId, jobId, sceneId, runnerId, startedAt, completedAt, durationMs, status, frames } = payload

  if (!runId || !jobId || !sceneId || !runnerId) {
    throw new ValidationError('runId, jobId, sceneId, and runnerId are required')
  }

  if (!['passed', 'failed', 'error'].includes(status)) {
    throw new ValidationError('status must be one of: passed, failed, error')
  }

  const normalizedFrames = (frames ?? []).map(f => ({
    ...f,
    frameId: f.frameId ?? '',
    assertions: f.assertions ?? [],
    response: f.response
      ? { ...f.response, headers: f.response.headers ?? {} }
      : { statusCode: 0, headers: {}, bodySize: 0, durationMs: 0 },
    request: f.request
      ? { ...f.request, headers: f.request.headers ?? {} }
      : f.request,
  }))

  let result
  try {
    result = await SceneResult.create({
      runId, jobId, sceneId, runnerId,
      startedAt, completedAt, durationMs, status,
      frames: normalizedFrames,
    })
  } catch (err) {
    console.error(err)
    throw new AppError('failed to save scene result', 500)
  }

  // Update scene with last run summary for dashboard/table display
  Scene.findOneAndUpdate(
    { id: sceneId },
    { $set: { lastRunStatus: status, lastRunAt: completedAt, lastRunId: runId } }
  ).catch(err => console.error('[results] failed to update scene last run:', err))

  // Pin the latest pass and latest fail so they survive beyond the 7-day TTL
  try {
    if (status === 'passed') {
      await pinLatest(result._id, sceneId, ['passed'])
    } else {
      await pinLatest(result._id, sceneId, ['failed', 'error'])
    }
  } catch (err) {
    console.error('pin management failed (non-fatal):', err)
  }

  return result
}

async function getSceneResultsSummary(sceneId) {
  const [recentRuns, lastPass, lastFail] = await Promise.all([
    SceneResult.find({ sceneId })
      .sort({ completedAt: -1 })
      .limit(5)
      .exec(),
    SceneResult.findOne(
      { sceneId, status: 'passed', expiresAt: null },
      'runId completedAt durationMs status'
    ).exec(),
    SceneResult.findOne(
      { sceneId, status: { $in: ['failed', 'error'] }, expiresAt: null },
      'runId completedAt durationMs status'
    ).exec(),
  ])

  return { recentRuns, lastPass, lastFail }
}

async function getResultsByScene(sceneId, page, limit) {
  const pageNum = parseInt(page) || 1
  const limitNum = parseInt(limit) || 20
  const skip = (pageNum - 1) * limitNum

  try {
    const [data, total] = await Promise.all([
      SceneResult.find({ sceneId }).sort({ completedAt: -1 }).skip(skip).limit(limitNum).exec(),
      SceneResult.countDocuments({ sceneId }),
    ])
    return { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum), data }
  } catch (err) {
    console.error(err)
    throw new AppError('failed to retrieve scene results', 500)
  }
}

async function getResultByRunId(runId) {
  try {
    return await SceneResult.findOne({ runId })
  } catch (err) {
    console.error(err)
    throw new AppError('failed to retrieve result', 500)
  }
}

async function getRecentResults(limit) {
  const limitNum = Math.min(parseInt(limit) || 50, 200)
  try {
    const results = await SceneResult
      .find()
      .sort({ completedAt: -1 })
      .limit(limitNum)
      .select('-frames')
      .exec()

    const sceneIds = [...new Set(results.map(r => r.sceneId))]
    const scenes = await Scene.find({ id: { $in: sceneIds } }).select('id name').exec()
    const sceneNameMap = Object.fromEntries(scenes.map(s => [s.id, s.name]))

    return results.map(r => ({ ...r.toObject(), sceneName: sceneNameMap[r.sceneId] ?? r.sceneId }))
  } catch (err) {
    console.error(err)
    throw new AppError('failed to retrieve recent results', 500)
  }
}

module.exports = {
  saveSceneResult,
  getSceneResultsSummary,
  getRecentResults,
  getResultsByScene,
  getResultByRunId,
}
