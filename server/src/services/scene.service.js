const Scene = require('../models/scene.model')
const { ConflictError, AppError, NotFoundError } = require('../utils/appError')
const crypto = require('crypto')
const scheduler = require('../utils/scheduler')

async function createNewScene(name, desc, timeout, cronSchedule, orgId, userId) {
  try {
    const scene = await Scene.create({
      id: `scene_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      name: name,
      description: desc,
      variables: {},
      frameIds: [],
      timeout: timeout,
      cronSchedule: cronSchedule,
      orgId: orgId,
      enabled: true,
      createdBy: userId,
    });
    scheduler.reload().catch(err => console.error('[scheduler] reload failed:', err))
    return { scene };
  } catch (err) {
    console.log(err);
    throw new AppError('failed to create scene', 500);
  }
}

async function listAllScenes(page, limit) {
  try {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const skip = (pageNum - 1) * limitNum;
    const scenes = await Scene.find().skip(skip).limit(limitNum).exec();
    const total = await Scene.countDocuments();
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limitNum),
      data: scenes,
    };
  } catch (err) {
    console.log(err);
    throw new AppError('failed to retrieve scenes', 500);
  }
}

async function listSingleScene(id) {
  try {
    const scene = await Scene.findOne({ id });
    if (!scene) throw new NotFoundError(`scene not found for id: ${id}`);
    return { scene };
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.log(err);
    throw new AppError('failed to retrieve scene', 500);
  }
}

async function updateScene(id, updates) {
  const allowed = {}
  const fields = ['name', 'description', 'timeout', 'cronSchedule', 'enabled', 'variables', 'frameIds']
  fields.forEach(f => { if (updates[f] !== undefined) allowed[f] = updates[f] })

  try {
    const scene = await Scene.findOneAndUpdate(
      { id },
      { $set: allowed },
      { new: true, runValidators: true }
    )
    if (!scene) throw new NotFoundError(`scene not found for id: ${id}`)
    scheduler.reload().catch(err => console.error('[scheduler] reload failed:', err))
    return { scene }
  } catch (err) {
    if (err instanceof AppError) throw err
    console.log(err)
    throw new AppError('failed to update scene', 500)
  }
}

async function deleteScene(id) {
  try {
    const scene = await Scene.findOneAndDelete({ id })
    if (!scene) throw new NotFoundError(`scene not found for id: ${id}`)
    scheduler.reload().catch(err => console.error('[scheduler] reload failed:', err))
    return { scene }
  } catch (err) {
    if (err instanceof AppError) throw err
    console.log(err)
    throw new AppError('failed to delete scene', 500)
  }
}

module.exports = {
  createNewScene,
  listSingleScene,
  listAllScenes,
  updateScene,
  deleteScene
}