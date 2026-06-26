const mongoose = require('mongoose')

const RunnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  keyId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  encryptedSecret: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastSeen: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'disabled', 'offline'],
    default: 'active',
  },
  performanceMetrics: {
    cpuPercent:  { type: Number, default: null },
    memUsedMb:   { type: Number, default: null },
    heapAllocMb: { type: Number, default: null },
    workers:     { type: Number, default: null },
    activeJobs:  { type: Number, default: null },
    recordedAt:  { type: Date,   default: null },
  },
  metadata: {
    type: Map,
    of: String,
    default: {},
  },
  multipleInstances: {
    type: Boolean,
    default: false,
  },
  credentialBorrowers: {
    type: [String],
    default: [],
  },
});

module.exports = mongoose.model('Runner', RunnerSchema);
