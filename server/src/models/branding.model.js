const mongoose = require('mongoose')

const BrandingSchema = new mongoose.Schema({
  image: {
    type: Buffer,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
}, { timestamps: true })

module.exports = mongoose.model('Branding', BrandingSchema)
