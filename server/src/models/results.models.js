const mongoose = require('mongoose')

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const FrameRequestSchema = new mongoose.Schema({
  method:  { type: String, required: true },
  url:     { type: String, required: true },
  headers: { type: Map, of: String, default: {} },
}, { _id: false })

const FrameResponseSchema = new mongoose.Schema({
  statusCode: { type: Number, required: true },
  headers:    { type: Map, of: String, default: {} },
  bodySize:   { type: Number, default: 0 },
  durationMs: { type: Number, required: true },
}, { _id: false })

const AssertionResultSchema = new mongoose.Schema({
  type:     { type: String, required: true },
  operator: { type: String, required: true },
  source:   { type: String, required: true },
  expected: { type: mongoose.Schema.Types.Mixed },
  actual:   { type: mongoose.Schema.Types.Mixed },
  passed:   { type: Boolean, required: true },
}, { _id: false })

const FrameResultSchema = new mongoose.Schema({
  frameId:     { type: String, default: '' },
  name:        { type: String, required: true },
  order:       { type: Number, required: true },
  startedAt:   { type: Date, required: true },
  completedAt: { type: Date, required: true },
  durationMs:  { type: Number, required: true },
  status:      { type: String, enum: ['passed', 'failed', 'error'], required: true },
  request:     { type: FrameRequestSchema, required: true },
  response:    { type: FrameResponseSchema, required: true },
  assertions:  { type: [AssertionResultSchema], default: [] },
  error:       { type: String, default: null },
}, { _id: false })

const SceneResultSchema = new mongoose.Schema({
  runId:       { type: String, required: true, index: true },
  jobId:       { type: String, required: true, index: true },
  sceneId:     { type: String, required: true },
  runnerId:    { type: String, required: true },
  startedAt:   { type: Date, required: true },
  completedAt: { type: Date, required: true },
  durationMs:  { type: Number, required: true },
  status:      { type: String, enum: ['passed', 'failed', 'error'], required: true },
  frames:      { type: [FrameResultSchema], default: [] },
  // null = pinned (keep forever); set to a future Date to allow TTL deletion
  expiresAt:   { type: Date, default: () => new Date(Date.now() + WEEK_MS) },
}, { timestamps: true })

// TTL: MongoDB ignores documents where expiresAt is null
SceneResultSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
// Fast recent-run lookups
SceneResultSchema.index({ sceneId: 1, completedAt: -1 })
// Fast pin lookups (finding the pinned pass/fail per scene)
SceneResultSchema.index({ sceneId: 1, status: 1, expiresAt: 1 })

module.exports = { SceneResult: mongoose.model('SceneResult', SceneResultSchema), WEEK_MS }
