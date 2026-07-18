const express = require('express')
const multer = require('multer')

const { authenticateJWT } = require('../middleware/auth')
const { getBrandingImage, uploadBranding } = require('../controllers/branding.controller')
const { ValidationError } = require('../utils/appError')

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon']
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 // 2MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new ValidationError('Image must be PNG, JPEG, SVG, WEBP, or ICO'))
    }
    cb(null, true)
  }
})

const router = express.Router()

/**
 * @swagger
 * /api/v1/branding/image:
 *   get:
 *     summary: Get the current org logo/favicon image
 *     tags: [Branding]
 *     responses:
 *       200:
 *         description: Image bytes (custom upload, or bundled default if none set)
 */
router.get('/branding/image', getBrandingImage)

/**
 * @swagger
 * /api/v1/branding:
 *   put:
 *     summary: Upload a new org logo/favicon image
 *     tags: [Branding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Branding image updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authenticated or not an admin
 */
router.put('/branding', authenticateJWT, upload.single('image'), uploadBranding)

module.exports = router
