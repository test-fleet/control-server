const mongoose = require('mongoose')

const VariableSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['string', 'number', 'boolean'],
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed, 
    default: null
  }
}, { _id: false });

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
    trim: true
  },
  variables: {
    type: Map,
    of: VariableSchema,
    default: {}
  },
  frameIds: [{
    type: String,
    required: true
  }],
  timeout: {
    type: Number,
    required: true,
    default: 300000, // 5 minutes default
    min: 1000 // 1 second
  },
  orgId: {
    type: String,
    required: true,
    index: true
  },
  cronSchedule: {
    type: String,
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'scenes'
});

module.exports = mongoose.model('Scene', SceneSchema);