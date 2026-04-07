const { ROLES } = require('../utils/constants')
const { UnauthorizedError, ValidationError } = require('../utils/appError')
const sceneService = require('../services/scene.service')

async function createScene(req, res, next) {
  const sceneName = req.body.name
  if (!sceneName) return next(new ValidationError('no scene name provided'))

  const sceneDescription = req.body.description

  const sceneTimeout = req.body.timeout || 30000 //! might wanna validate to > 0 or min threshold

  const userId = req.user.id
  const orgId = 'this field doesnt exist'

  try {
    const scene = await sceneService.createNewScene(sceneName, sceneDescription, sceneTimeout, orgId, userId)
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

}

async function listScene(req, res, next) {

}

async function updateScene(req, res, next) {

}

async function deleteScene(req, res, next) {
  //! Cascade delete frames and all other artifacts
}

module.exports = {
  createScene,
  listAllScenes,
  listScene,
  updateScene,
  deleteScene
}