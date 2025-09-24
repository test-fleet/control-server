const mongoose = require('mongoose')
const { STATUS, ROLES } = require('../utils/constants')

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  userName: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: [ROLES.ADMIN, ROLES.USER],
    default: ROLES.USER
  },
  status: {
    type: String,
    enum: [STATUS.ACTIVE, STATUS.INVITED, STATUS.DISABLED],
    default: STATUS.INVITED
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
}, { timestamps: true })

module.exports = mongoose.model('User', UserSchema)
