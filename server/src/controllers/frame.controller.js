const { ValidationError } = require('../utils/appError')
const frameService = require('../services/frame.service')
const { testFrame: testFrameRequest } = require('../services/frame.test.service')

async function createFrame(req, res, next) {
  const { sceneId } = req.params
  const { name, request } = req.body

  if (!name) return next(new ValidationError('frame name is required'))
  if (!request?.method) return next(new ValidationError('request method is required'))
  if (!request?.url) return next(new ValidationError('request url is required'))

  try {
    const result = await frameService.createNewFrame(sceneId, req.body)
    res.status(201).json({ message: 'Frame created', ...result })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function listFrames(req, res, next) {
  const { sceneId } = req.params
  try {
    const result = await frameService.listFrames(sceneId)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function deleteFrame(req, res, next) {
  const { sceneId, frameId } = req.params
  try {
    const result = await frameService.deleteFrame(sceneId, frameId)
    res.status(200).json({ message: 'Frame deleted', ...result })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function updateFrame(req, res, next) {
  const { sceneId, frameId } = req.params
  try {
    const result = await frameService.updateFrame(sceneId, frameId, req.body)
    res.status(200).json({ message: 'Frame updated', ...result })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function reorderFrames(req, res, next) {
  const { sceneId } = req.params
  const { frameIds } = req.body
  if (!Array.isArray(frameIds)) return next(new ValidationError('frameIds must be an array'))
  try {
    const result = await frameService.reorderFrames(sceneId, frameIds)
    res.status(200).json({ message: 'Frames reordered', ...result })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function testFrame(req, res, next) {
  const { request, assertions } = req.body
  if (!request?.url) return next(new ValidationError('request.url is required'))
  if (!request?.method) return next(new ValidationError('request.method is required'))
  try {
    const frame = await testFrameRequest({ request, assertions })
    res.json({ frame })
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  createFrame,
  listFrames,
  updateFrame,
  deleteFrame,
  reorderFrames,
  testFrame,
}
