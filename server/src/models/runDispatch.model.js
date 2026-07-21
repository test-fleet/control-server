const mongoose = require('mongoose')

// Durable record of a scene job at the moment it's published to Redis —
// exists because Redis Pub/Sub has no persistence: if the runner that was
// supposed to pick this up is offline, the message is gone forever and this
// is the only trace the run was ever dispatched. Lets dispatchSweeper find
// and finalize runs that never got a report, even across a control-server
// restart (unlike the in-memory maps this replaces).
const RunDispatchSchema = new mongoose.Schema({
  runId:           { type: String, required: true, unique: true, index: true },
  sceneId:         { type: String, required: true },
  sceneName:       { type: String, required: true },
  expectedRunners: { type: Number, required: true },
  dispatchedAt:    { type: Date, required: true },
  deadline:        { type: Date, required: true }, // dispatchedAt + scene.timeout
  resolved:        { type: Boolean, default: false },
  // TTL cleanup, well past deadline so the sweep always has time to visit it first
  expiresAt:       { type: Date, required: true },
})

// Serves dispatchSweeper's "find overdue, unresolved dispatches" query
RunDispatchSchema.index({ resolved: 1, deadline: 1 })
RunDispatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('RunDispatch', RunDispatchSchema)
