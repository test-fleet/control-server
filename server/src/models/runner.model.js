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
  metadata: {
    type: Map,
    of: String,
    default: {},
  },
});

module.exports = mongoose.model('Runner', RunnerSchema);
