const Branding = require('../models/branding.model')

async function getBranding() {
  return Branding.findOne()
}

async function setBranding(buffer, mimeType, userId) {
  return Branding.findOneAndUpdate(
    {},
    { image: buffer, mimeType, updatedBy: userId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
}

module.exports = {
  getBranding,
  setBranding
}
