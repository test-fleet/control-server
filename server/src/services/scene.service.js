const Scene = require('../models/scene.model')
const { ConflictError, AppError } = require('../utils/appError')
const crypto = require('crypto')

async function createNewScene(name, desc, timeout, orgId, userId) {
  try {
    const scene = await Scene.create({
      id: `scene_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      name: name,
      description: desc,
      variables: {},
      frameIds: [],
      timeout: timeout, 
      orgId: orgId,
      enabled: true,
      createdBy: userId,
    });
    return {
      scene
    }
  } catch (err) {
    console.log(err)
    throw new AppError('failed to create scene', 500)
  }
}

async function listSingleScene(id) {

}

async function listAllScenes() {

}

async function updateScene() {

}

async function deleteScene() {

}

module.exports = {
  createNewScene,
  listSingleScene,
  listAllScenes,
  updateScene,
  deleteScene
}