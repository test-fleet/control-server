const express = require('express')
const { authenticateJWT } = require('../middleware/auth')
const { getDashboardSummary } = require('../controllers/dashboard.controller')

const router = express.Router()

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Fleet-wide dashboard summary
 *     description: Server-computed scene/runner/user counts plus a prioritized alerts list (offline runners, shared credentials, failing scenes). Requires JWT authentication.
 *     responses:
 *       200:
 *         description: Summary retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get('/dashboard/summary', authenticateJWT, getDashboardSummary)

module.exports = router
