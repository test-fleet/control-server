const { ValidationError } = require('../utils/appError')
const sceneService = require('../services/scene.service')

async function createScene(req, res, next) {
  const sceneName = req.body.name
  if (!sceneName) return next(new ValidationError('no scene name provided'))

  const sceneDescription = req.body.description
  const sceneTimeout = req.body.timeout || 30000 //! might wanna validate to > 0 or min threshold
  const sceneCronSchedule = req.body.cronSchedule
  if (!sceneCronSchedule) return next(new ValidationError('no cron schedule provided'))

  const userId = req.user.id
  const orgId = 'this field doesnt exist'

  try {
    const scene = await sceneService.createNewScene(sceneName, sceneDescription, sceneTimeout, sceneCronSchedule, orgId, userId)
    res.status(201).json({
      message: 'Scene created',
      scene: scene
    })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function listAllScenes(req, res, next) {
  try {
    const { page, limit } = req.query
    const result = await sceneService.listAllScenes(page, limit)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function listScene(req, res, next) {
  const { id } = req.params
  try {
    const result = await sceneService.listSingleScene(id)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function updateScene(req, res, next) {
  const { id } = req.params
  try {
    const result = await sceneService.updateScene(id, req.body)
    res.status(200).json({ message: 'Scene updated', ...result })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function deleteScene(req, res, next) {
  //! Cascade delete frames and all other artifacts
  const { id } = req.params
  try {
    const result = await sceneService.deleteScene(id)
    res.status(200).json({ message: 'Scene deleted', ...result })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

module.exports = {
  createScene,
  listAllScenes,
  listScene,
  updateScene,
  deleteScene
}
