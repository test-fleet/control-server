const express = require('express')
const { authenticateJWT, authenticateRunner } = require('../middleware/auth')
const { createRunner, listRunners, runnerHeartbeat, runnerMetrics } = require('../controllers/runner.controller')
const router = express.Router()

/**
 * @openapi
 * /runners/register:
 *   post:
 *     tags:
 *       - Runners
 *     summary: Register a new runner
 *     description: Creates a new runner instance. Requires admin JWT authentication.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         description: Bearer token for admin user
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: runner-1-east
 *     responses:
 *       201:
 *         description: Runner successfully registered
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires admin privileges
 */
router.post('/runners/register', authenticateJWT, createRunner)

/**
 * @openapi
 * /runners:
 *   get:
 *     tags:
 *       - Runners
 *     summary: List all runners
 *     description: Retrieves a paginated list of registered runners
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         description: Bearer token for authenticated user
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of runners per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Successfully retrieved runners list
 *       401:
 *         description: Unauthorized
 */
router.get('/runners', authenticateJWT, listRunners)

/**
 * @openapi
 * /runners/heartbeat:
 *   post:
 *     tags:
 *       - Runners
 *     summary: Send runner heartbeat
 *     description: Updates runner status. Requires API key authentication with HMAC signature.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         description: ApiKey authentication
 *         schema:
 *           type: string
 *           example: ApiKey run_abc123def456
 *       - in: header
 *         name: x-request-timestamp
 *         required: true
 *         description: ISO 8601 timestamp of request
 *         schema:
 *           type: string
 *           example: 2025-10-01T12:00:00Z
 *       - in: header
 *         name: signature
 *         required: true
 *         description: HMAC signature of canonical string encrypted with apiSecret
 *         schema:
 *           type: string
 *           example: a3f8d9c7b2e1f4a6c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Heartbeat received successfully
 *       401:
 *         description: Unauthorized - Invalid API key or signature
 */
router.post('/runners/heartbeat', authenticateRunner, runnerHeartbeat)

router.get('/runner/:id/metrics', authenticateJWT, runnerMetrics)

module.exports = router