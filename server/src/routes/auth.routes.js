const express = require('express')
const { oauthLogin, oauthCallback, logout, me } = require('../controllers/auth.controller')
const { authenticateJWT } = require('../middleware/auth')

const router = express.Router()

/**
 * @openapi
 * /auth/oauth:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Initiates OAuth login flow
 *     description: Redirects user to OAuth provider login page
 *     responses:
 *       302:
 *         description: Redirects to OAuth provider
 */
router.get('/auth/oauth', oauthLogin)

/**
 * @openapi
 * /auth/callback:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: OAuth callback endpoint
 *     description: Handles the OAuth provider callback and creates user session
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from OAuth provider
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       400:
 *         description: Invalid request
 */
router.get('/auth/callback', oauthCallback)

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout user
 *     description: Invalidates user session and clears authentication
 *     responses:
 *       200:
 *         description: Successfully logged out
 *       401:
 *         description: Unauthorized
 */
router.post('/auth/logout', logout)

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get current user info
 *     description: Returns information about the currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/auth/me', authenticateJWT, me)

module.exports = router