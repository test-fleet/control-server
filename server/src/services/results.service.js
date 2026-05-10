const { SceneResult, WEEK_MS } = require('../models/results.models')
const Scene = require('../models/scene.model')
const Runner = require('../models/runner.model')
const { AppError, ValidationError } = require('../utils/appError')
const { getJobExpectedRunners } = require('../utils/jobCache')

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
  const { runId, jobId, sceneId, runnerId, startedAt, completedAt, durationMs, status, frames, expectedRunners } = payload

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

  // Prefer the server-side dispatch cache over whatever the runner sent (or the default).
  // Runners are not required to echo expectedRunners back; the scheduler stamps it.
  const resolvedExpectedRunners = getJobExpectedRunners(runId) ?? expectedRunners ?? 1

  let result
  try {
    result = await SceneResult.create({
      runId, jobId, sceneId, runnerId,
      expectedRunners: resolvedExpectedRunners,
      startedAt, completedAt, durationMs, status,
      frames: normalizedFrames,
    })
  } catch (err) {
    console.error(err)
    throw new AppError('failed to save scene result', 500)
  }

  const sceneUpdate = { lastRunStatus: status, lastRunAt: completedAt, lastRunId: runId }
  if (status === 'passed') sceneUpdate.lastPassAt = completedAt
  else sceneUpdate.lastFailAt = completedAt

  Scene.findOneAndUpdate({ id: sceneId }, { $set: sceneUpdate })
    .catch(err => console.error('[results] failed to update scene last run:', err))

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

// Shared aggregation pipeline stages for grouping results by runId
function _buildRunPipeline(preMatch, statusFilter) {
  const pipeline = [
    ...(Object.keys(preMatch).length > 0 ? [{ $match: preMatch }] : []),
    {
      $group: {
        _id: '$runId',
        sceneId:          { $first: '$sceneId' },
        startedAt:        { $min: '$startedAt' },
        completedAt:      { $max: '$completedAt' },
        expectedRunners:  { $max: '$expectedRunners' },
        reportedRunners:  { $sum: 1 },
        passedRunners:    { $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] } },
      }
    },
    {
      $lookup: {
        from: 'scenes',
        localField: 'sceneId',
        foreignField: 'id',
        as: 'scene',
      }
    },
    {
      $addFields: {
        runId:         '$_id',
        sceneName:     { $ifNull: [{ $arrayElemAt: ['$scene.name', 0] }, '$sceneId'] },
        passThreshold: { $ifNull: [{ $arrayElemAt: ['$scene.passThreshold', 0] }, 1.0] },
        sceneTimeout:  { $ifNull: [{ $arrayElemAt: ['$scene.timeout', 0] }, 30000] },
        durationMs:    { $subtract: ['$completedAt', '$startedAt'] },
        // Guard against stale DB rows (expectedRunners defaulted to 1 before the cache fix):
        // reported runners can never exceed expected, so take the max.
        expectedRunners: { $max: ['$expectedRunners', '$reportedRunners'] },
      }
    },
    {
      $addFields: {
        _isPending: {
          $and: [
            { $lt: ['$reportedRunners', '$expectedRunners'] },
            { $gt: [{ $add: ['$startedAt', '$sceneTimeout'] }, '$$NOW'] }
          ]
        }
      }
    },
    {
      $addFields: {
        status: {
          $cond: {
            if: '$_isPending',
            then: 'pending',
            else: {
              $cond: {
                if: {
                  $cond: {
                    if: { $eq: ['$passThreshold', 0] },
                    then: { $gte: ['$passedRunners', 1] },
                    else: {
                      $gte: [
                        { $cond: [{ $eq: ['$expectedRunners', 0] }, 0, { $divide: ['$passedRunners', '$expectedRunners'] }] },
                        '$passThreshold'
                      ]
                    }
                  }
                },
                then: 'passed',
                else: 'failed'
              }
            }
          }
        }
      }
    },
    {
      $project: { scene: 0, sceneTimeout: 0, _isPending: 0, _id: 0 }
    },
    { $sort: { completedAt: -1 } },
  ]

  if (statusFilter && statusFilter !== 'all') {
    pipeline.push({ $match: { status: statusFilter } })
  }

  return pipeline
}

async function getAggregatedRuns(limit, status, sceneId, page) {
  const limitNum = Math.min(parseInt(limit) || 20, 100)
  const pageNum = Math.max(parseInt(page) || 1, 1)
  const skip = (pageNum - 1) * limitNum

  const preMatch = {}
  if (sceneId) preMatch.sceneId = sceneId

  const pipeline = _buildRunPipeline(preMatch, status)
  const countPipeline = [...pipeline, { $count: 'total' }]
  pipeline.push({ $skip: skip }, { $limit: limitNum })

  try {
    const [results, countResult] = await Promise.all([
      SceneResult.aggregate(pipeline),
      SceneResult.aggregate(countPipeline),
    ])
    const total = countResult[0]?.total || 0
    return { data: results, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
  } catch (err) {
    console.error(err)
    throw new AppError('failed to retrieve aggregated runs', 500)
  }
}

async function getSceneResultsSummary(sceneId) {
  const pipeline = _buildRunPipeline({ sceneId }, null)
  pipeline.push({ $limit: 5 })

  const [recentRuns, lastPass, lastFail] = await Promise.all([
    SceneResult.aggregate(pipeline),
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
    const results = await SceneResult.find({ runId }).sort({ completedAt: 1 }).exec()
    if (results.length === 0) return null

    const sceneId = results[0].sceneId
    const scene = await Scene.findOne({ id: sceneId }).select('name passThreshold timeout').exec()

    const storedExpected = Math.max(...results.map(r => r.expectedRunners ?? 1))
    const expectedRunners = Math.max(storedExpected, results.length)
    const passThreshold = scene?.passThreshold ?? 1.0
    const sceneTimeout = scene?.timeout ?? 30000
    const reportedRunners = results.length
    const passedRunners = results.filter(r => r.status === 'passed').length

    const isPending = reportedRunners < expectedRunners &&
      Date.now() < new Date(results[0].startedAt).getTime() + sceneTimeout

    let status
    if (isPending) {
      status = 'pending'
    } else {
      const meets = passThreshold === 0
        ? passedRunners >= 1
        : passedRunners / expectedRunners >= passThreshold
      status = meets ? 'passed' : 'failed'
    }

    const runnerKeyIds = [...new Set(results.map(r => r.runnerId))]
    const runnerDocs = await Runner.find({ keyId: { $in: runnerKeyIds } }).select('keyId name').exec()
    const runnerNameMap = Object.fromEntries(runnerDocs.map(r => [r.keyId, r.name]))

    return {
      runId,
      sceneId,
      sceneName: scene?.name ?? sceneId,
      expectedRunners,
      reportedRunners,
      passedRunners,
      passThreshold,
      status,
      isPending,
      startedAt: results[0].startedAt,
      completedAt: results[results.length - 1].completedAt,
      durationMs: new Date(results[results.length - 1].completedAt) - new Date(results[0].startedAt),
      runners: results.map(r => ({
        runnerId: r.runnerId,
        runnerName: runnerNameMap[r.runnerId] ?? r.runnerId,
        status: r.status,
        durationMs: r.durationMs,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        frames: r.frames,
      }))
    }
  } catch (err) {
    console.error(err)
    throw new AppError('failed to retrieve result', 500)
  }
}

async function getRecentResults(limit, status, sceneId, page) {
  const limitNum = Math.min(parseInt(limit) || 20, 100)
  const pageNum = Math.max(parseInt(page) || 1, 1)
  const skip = (pageNum - 1) * limitNum

  const query = {}
  if (status && status !== 'all') query.status = status
  if (sceneId) query.sceneId = sceneId

  try {
    const [results, total] = await Promise.all([
      SceneResult.find(query)
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-frames')
        .exec(),
      SceneResult.countDocuments(query),
    ])

    const sceneIds = [...new Set(results.map(r => r.sceneId))]
    const scenes = await Scene.find({ id: { $in: sceneIds } }).select('id name').exec()
    const sceneNameMap = Object.fromEntries(scenes.map(s => [s.id, s.name]))

    const data = results.map(r => ({ ...r.toObject(), sceneName: sceneNameMap[r.sceneId] ?? r.sceneId }))
    return { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
  } catch (err) {
    console.error(err)
    throw new AppError('failed to retrieve recent results', 500)
  }
}

module.exports = {
  saveSceneResult,
  getSceneResultsSummary,
  getAggregatedRuns,
  getRecentResults,
  getResultsByScene,
  getResultByRunId,
}
