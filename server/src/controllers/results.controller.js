const { ValidationError } = require('../utils/appError')
const resultsService = require('../services/results.service')

async function submitResult(req, res, next) {
  if (!req.body || typeof req.body !== 'object') {
    return next(new ValidationError('request body is required'))
  }

  try {
    const result = await resultsService.saveSceneResult(req.body)
    res.status(201).json({ success: true, id: result._id })
  } catch (err) {
    console.error(err)
    return next(err)
  }
}

async function getSceneResultsSummary(req, res, next) {
  const { sceneId } = req.params

  try {
    const summary = await resultsService.getSceneResultsSummary(sceneId)
    res.status(200).json({ success: true, ...summary })
  } catch (err) {
    console.error(err)
    return next(err)
  }
}

async function getResultsByScene(req, res, next) {
  const { sceneId } = req.params
  const { page, limit } = req.query

  try {
    const results = await resultsService.getResultsByScene(sceneId, page, limit)
    res.status(200).json({ success: true, ...results })
  } catch (err) {
    console.error(err)
    return next(err)
  }
}

async function getResultByRunId(req, res, next) {
  const { runId } = req.params

  try {
    const result = await resultsService.getResultByRunId(runId)
    res.status(200).json({ success: true, data: result })
  } catch (err) {
    console.error(err)
    return next(err)
  }
}

async function getRecentResults(req, res, next) {
  const { limit, status, sceneId } = req.query
  try {
    const results = await resultsService.getRecentResults(limit, status, sceneId)
    res.status(200).json({ success: true, data: results })
  } catch (err) {
    console.error(err)
    return next(err)
  }
}

module.exports = {
  submitResult,
  getSceneResultsSummary,
  getRecentResults,
  getResultsByScene,
  getResultByRunId,
}
