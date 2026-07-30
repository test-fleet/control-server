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
  // Admin-controlled lifecycle only ('active' vs 'disabled') — never flips on
  // its own. Liveness (is it actually responding right now) is a separate,
  // computed-not-persisted concept; see utils/runnerHealth.js. There used to
  // be a third 'offline' enum value here, but nothing ever wrote it —
  // VALID_STATUSES in runner.controller.js already only accepted
  // active/disabled — so it was dead schema, not a real state.
  status: {
    type: String,
    enum: ['active', 'disabled'],
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
