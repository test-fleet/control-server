const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['invited', 'active', 'disabled'],
    default: ['invited']
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
}, { timeStamps: true })

// userSchema.index({ email: 1 });
// userSchema.index({ role: 1, status: 1 });

module.exports = mongoose.model('user', UserSchema)