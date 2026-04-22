const express = require('express')
const { authenticateJWT, authenticateRunner } = require('../middleware/auth')
const { submitResult, getSceneResultsSummary, getRecentResults, getResultsByScene, getResultByRunId } = require('../controllers/results.controller')
const router = express.Router()

/**
 * @openapi
 * /results:
 *   post:
 *     tags:
 *       - Results
 *     summary: Submit scene run results
 *     description: Accepts the full result payload for a completed scene job. Requires runner API key authentication with HMAC signature.
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
 *         description: HMAC-SHA256 signature of canonical string using runner secret
 *         schema:
 *           type: string
 *           example: sha256=a3f8d9c7b2e1...
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - runId
 *               - jobId
 *               - sceneId
 *               - runnerId
 *               - startedAt
 *               - completedAt
 *               - durationMs
 *               - status
 *             properties:
 *               runId:
 *                 type: string
 *               jobId:
 *                 type: string
 *               sceneId:
 *                 type: string
 *               runnerId:
 *                 type: string
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *               completedAt:
 *                 type: string
 *                 format: date-time
 *               durationMs:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [passed, failed, error]
 *               frames:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/FrameResult'
 *     responses:
 *       201:
 *         description: Results saved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/results', authenticateRunner, submitResult)

/**
 * @openapi
 * /results/recent:
 *   get:
 *     tags:
 *       - Results
 *     summary: Get recent results across all scenes
 *     description: Returns the most recent results across all scenes, without frame details. Used for dashboard and run feeds.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 50
 *     responses:
 *       200:
 *         description: List of recent results
 *       401:
 *         description: Unauthorized
 */
router.get('/results/recent', authenticateJWT, getRecentResults)

/**
 * @openapi
 * /results/scene/{sceneId}/summary:
 *   get:
 *     tags:
 *       - Results
 *     summary: Get scene results summary
 *     description: Returns the last 5 runs (with frame details), the most recent passed result, and the most recent failed/error result for a scene. Pinned pass/fail results are preserved beyond the 7-day TTL.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       - in: path
 *         name: sceneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scene results summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recentRuns:
 *                   type: array
 *                   description: Up to 5 most recent runs, newest first
 *                 lastPass:
 *                   description: Most recent passed result (null if none)
 *                 lastFail:
 *                   description: Most recent failed/error result (null if none)
 *       401:
 *         description: Unauthorized
 */
router.get('/results/scene/:sceneId/summary', authenticateJWT, getSceneResultsSummary)

/**
 * @openapi
 * /results/scene/{sceneId}:
 *   get:
 *     tags:
 *       - Results
 *     summary: Get paginated results for a scene
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       - in: path
 *         name: sceneId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *     responses:
 *       200:
 *         description: Paginated list of scene results
 *       401:
 *         description: Unauthorized
 */
router.get('/results/scene/:sceneId', authenticateJWT, getResultsByScene)

/**
 * @openapi
 * /results/run/{runId}:
 *   get:
 *     tags:
 *       - Results
 *     summary: Get result by run ID
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scene result
 *       401:
 *         description: Unauthorized
 */
router.get('/results/run/:runId', authenticateJWT, getResultByRunId)

module.exports = router
