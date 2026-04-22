const mongoose = require('mongoose')

const ExtractorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['json', 'header'],
    lowercase: true
  },
  source: {
    type: String,
    required: true,
    trim: true
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'null'],
    default: 'string'
  }
}, { _id: false })

const AssertionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    trim: true
  },
  operator: {
    type: String,
    required: true,
    trim: true
  },
  expected: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  source: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false })

const HTTPRequestSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    uppercase: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  headers: {
    type: Map,
    of: String,
    default: {}
  },
  //! Stored as raw string — ${varName} placeholders are resolved by the runner
  //!  at execution time. Never parse or re-serialize this field server-side.
  body: {
    type: String,
    default: ''
  },
  timeout: {
    type: Number,
    default: 30000,
    min: 1000
  }
}, { _id: false })

const FrameSchema = new mongoose.Schema({
  sceneId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  order: {
    type: Number,
    required: true,
    min: 0
  },
  enabled: {
    type: Boolean,
    default: true
  },
  request: {
    type: HTTPRequestSchema,
    required: true
  },
  extractors: {
    type: [ExtractorSchema],
    default: []
  },
  assertions: {
    type: [AssertionSchema],
    default: []
  }
}, {
  timestamps: true,
  collection: 'frames'
})

FrameSchema.index({ sceneId: 1, order: 1 })

module.exports = mongoose.model('Frame', FrameSchema)