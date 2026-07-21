const path = require('path')
const fs = require('fs')

const brandingService = require('../services/branding.service')
const { ROLES } = require('../utils/constants')
const { ValidationError, ForbiddenError } = require('../utils/appError')

const DEFAULT_FAVICON_PATH = path.resolve(process.cwd(), 'frontend', 'dist', 'favicon.svg')

async function getBrandingImage(req, res, next) {
  try {
    const branding = await brandingService.getBranding()

    if (!branding) {
      res.set('Content-Type', 'image/svg+xml')
      res.set('Cache-Control', 'no-cache')
      return fs.createReadStream(DEFAULT_FAVICON_PATH).pipe(res)
    }

    res.set('Content-Type', branding.mimeType)
    res.set('Cache-Control', 'no-cache')
    res.set('ETag', String(branding.updatedAt.getTime()))
    res.send(branding.image)
  } catch (err) {
    return next(err)
  }
}

async function uploadBranding(req, res, next) {
  if (req.user.role !== ROLES.ADMIN) {
    return next(new ForbiddenError('You must be an admin to update branding'))
  }

  if (!req.file) {
    return next(new ValidationError('An image file must be provided'))
  }

  try {
    await brandingService.setBranding(req.file.buffer, req.file.mimetype, req.user._id)
    res.status(200).json({
      message: 'branding image updated'
    })
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  getBrandingImage,
  uploadBranding
}
