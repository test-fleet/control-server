const mongoose = require('mongoose')

const VariableSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['string', 'number', 'boolean', 'null'],
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { _id: false })

const SceneSchema = new mongoose.Schema({
    id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  variables: {
    type: Map,
    of: VariableSchema,
    default: {}
  },
  frameIds: [{
    type: String
  }],
  timeout: {
    type: Number,
    required: true,
    default: 300000,
    min: 1000
  },
  orgId: {
    type: String,
    required: true,
    index: true
  },
  cronSchedule: {
    type: String,
    required: true,
    trim: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  },
  passThreshold: { type: Number, default: 1.0, min: 0, max: 1 },
  lastRunStatus: { type: String, enum: ['passed', 'failed', 'error', null], default: null },
  lastRunAt:     { type: Date, default: null },
  lastRunId:     { type: String, default: null },
  lastPassAt:    { type: Date, default: null },
  lastFailAt:    { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'scenes'
})

module.exports = mongoose.model('Scene', SceneSchema)