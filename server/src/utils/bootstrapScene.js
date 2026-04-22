const path = require('path')
const fs = require('fs')
const Scene = require('../models/scene.model')
const Frame = require('../models/frame.model')

// Fixed id so we can idempotently detect the bootstrap scene across restarts
const BOOTSTRAP_SCENE_ID = 'scene_internal_health_check'

async function bootstrapScene(adminToken) {
  const existing = await Scene.findOne({ id: BOOTSTRAP_SCENE_ID })
  if (existing) {
    console.log('[bootstrap] Health check scene already exists')
    return
  }

  const port = process.env.PORT || 3000
  const baseUrl = (process.env.SERVER_URL || `http://localhost:${port}`).replace(/\/$/, '')

  await Scene.create({
    id: BOOTSTRAP_SCENE_ID,
    name: 'Control Server Health Check',
    description: 'Smoke tests for the control server API itself. Auto-generated on startup.',
    variables: {},
    frameIds: [],
    timeout: 30000,
    cronSchedule: '*/5 * * * *',
    orgId: 'internal',
    enabled: true,
    createdBy: 'server',
  })

  const jsonPath = path.join(__dirname, 'healthCheckFrames.json')
  const raw = fs.readFileSync(jsonPath, 'utf8')
    .replace(/\{\{BASE_URL\}\}/g, baseUrl)
    .replace(/\{\{ADMIN_TOKEN\}\}/g, adminToken)
  const frameDefinitions = JSON.parse(raw)

  const frameIds = []
  for (let i = 0; i < frameDefinitions.length; i++) {
    const def = frameDefinitions[i]
    const frame = await Frame.create({
      sceneId: BOOTSTRAP_SCENE_ID,
      name: def.name,
      order: i,
      enabled: true,
      request: def.request,
      extractors: def.extractors || [],
      assertions: def.assertions || [],
    })
    frameIds.push(frame._id.toString())
  }

  await Scene.findOneAndUpdate({ id: BOOTSTRAP_SCENE_ID }, { $set: { frameIds } })
  console.log(`[bootstrap] Health check scene created with ${frameIds.length} frames`)
}

module.exports = { bootstrapScene }
