const Frame = require('../models/frame.model')
const Scene = require('../models/scene.model')
const { AppError, NotFoundError } = require('../utils/appError')

async function listFrames(sceneId) {
  try {
    const scene = await Scene.findOne({ id: sceneId })
    if (!scene) throw new NotFoundError(`scene with id: ${sceneId} not found`)
    const frames = await Frame.find({ sceneId }).sort({ order: 1 })
    return { frames }
  } catch (err) {
    if (err instanceof AppError) throw err
    console.log(err)
    throw new AppError('failed to list frames', 500)
  }
}

async function deleteFrame(sceneId, frameId) {
  try {
    const frame = await Frame.findOneAndDelete({ _id: frameId, sceneId })
    if (!frame) throw new NotFoundError(`frame not found`)
    await Scene.findOneAndUpdate({ id: sceneId }, { $pull: { frameIds: frameId } })
    return { frame }
  } catch (err) {
    if (err instanceof AppError) throw err
    console.log(err)
    throw new AppError('failed to delete frame', 500)
  }
}

async function createNewFrame(sceneId, data) {
  try {
    const scene = await Scene.findOne({ id: sceneId })
    if (!scene) throw new NotFoundError(`scene with id: ${sceneId} not found`)

    const order = scene.frameIds.length

    const frame = await Frame.create({
      sceneId: sceneId,
      name: data.name,
      order: order,
      enabled: data.enabled ?? true,
      request: {
        method: data.request.method,
        url: data.request.url,
        headers: data.request.headers || {},
        body: data.request.body || '',
        timeout: data.request.timeout || 30000,
      },
      extractors: data.extractors || [],
      assertions: data.assertions || [],
    })

    await Scene.findOneAndUpdate(
      { id: sceneId },
      { $push: { frameIds: frame._id.toString() } }
    )

    return { frame }
  } catch (err) {
    if (err instanceof AppError) throw err
    console.log(err)
    throw new AppError('failed to create frame', 500)
  }
}

async function updateFrame(sceneId, frameId, data) {
  try {
    const allowed = {}
    if (data.name !== undefined) allowed.name = data.name
    if (data.enabled !== undefined) allowed.enabled = data.enabled
    if (data.request !== undefined) allowed.request = data.request
    if (data.extractors !== undefined) allowed.extractors = data.extractors
    if (data.assertions !== undefined) allowed.assertions = data.assertions

    const frame = await Frame.findOneAndUpdate(
      { _id: frameId, sceneId },
      { $set: allowed },
      { new: true, runValidators: true }
    )
    if (!frame) throw new NotFoundError(`frame not found`)
    return { frame }
  } catch (err) {
    if (err instanceof AppError) throw err
    console.log(err)
    throw new AppError('failed to update frame', 500)
  }
}

async function reorderFrames(sceneId, frameIds) {
  try {
    const scene = await Scene.findOne({ id: sceneId })
    if (!scene) throw new NotFoundError(`scene with id: ${sceneId} not found`)
    await Promise.all(frameIds.map((id, idx) => Frame.findByIdAndUpdate(id, { order: idx })))
    await Scene.findOneAndUpdate({ id: sceneId }, { $set: { frameIds } })
    return { success: true }
  } catch (err) {
    if (err instanceof AppError) throw err
    console.log(err)
    throw new AppError('failed to reorder frames', 500)
  }
}

module.exports = {
  createNewFrame,
  listFrames,
  updateFrame,
  deleteFrame,
  reorderFrames,
}
