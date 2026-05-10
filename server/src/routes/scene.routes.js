const express = require('express')
const { authenticateJWT } = require('../middleware/auth')
const { createScene, listAllScenes, listScene, updateScene, deleteScene, runScene } = require('../controllers/scene.controller')

const router = express.Router()

/**
 * @swagger
 * /api/v1/scene:
 *   post:
 *     summary: Create a new scene
 *     tags: [Scenes]
 *     security:
 *       - bearerAuth: []
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
 *                 example: Smoke Test Suite
 *               description:
 *                 type: string
 *                 example: Runs smoke tests against the production API
 *               timeout:
 *                 type: integer
 *                 description: Timeout in milliseconds
 *                 example: 30000
 *           example:
 *             name: "Smoke Test Suite"
 *             description: "Runs smoke tests against the production API"
 *             timeout: 30000
 *     responses:
 *       201:
 *         description: Scene created successfully
 *       400:
 *         description: Bad request - name is required
 *       401:
 *         description: Not authenticated
 */
router.post('/scene', authenticateJWT, createScene)

/**
 * @swagger
 * /api/v1/scenes:
 *   get:
 *     summary: List all scenes
 *     tags: [Scenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 12
 *         description: Number of scenes per page
 *     responses:
 *       200:
 *         description: Paginated list of scenes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Scene'
 *       401:
 *         description: Not authenticated
 */
router.get('/scenes', authenticateJWT, listAllScenes)

/**
 * @swagger
 * /api/v1/scene/{id}:
 *   get:
 *     summary: Get a single scene
 *     tags: [Scenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Scene ID (e.g. scene_1234567890_abcd1234)
 *     responses:
 *       200:
 *         description: Scene retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Scene'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Scene not found
 */
router.get('/scene/:id', authenticateJWT, listScene)

/**
 * @swagger
 * /api/v1/scene/{id}:
 *   put:
 *     summary: Update a scene
 *     tags: [Scenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Scene ID (e.g. scene_1234567890_abcd1234)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Smoke Test Suite
 *               description:
 *                 type: string
 *                 example: Updated description
 *               timeout:
 *                 type: integer
 *                 description: Timeout in milliseconds (minimum 1000)
 *                 example: 60000
 *               cronSchedule:
 *                 type: string
 *                 description: Cron expression for scheduled execution
 *                 example: "0 *\/6 * * *"
 *               enabled:
 *                 type: boolean
 *                 example: true
 *               variables:
 *                 type: object
 *                 description: Map of scene variables
 *                 example: {}
 *               frameIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Ordered list of frame IDs in this scene
 *                 example: []
 *     responses:
 *       200:
 *         description: Scene updated successfully
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Scene not found
 */
router.put('/scene/:id', authenticateJWT, updateScene)

/**
 * @swagger
 * /api/v1/scene/{id}:
 *   delete:
 *     summary: Delete a scene
 *     tags: [Scenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Scene ID (e.g. scene_1234567890_abcd1234)
 *     responses:
 *       200:
 *         description: Scene deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Scene not found
 */
router.delete('/scene/:id', authenticateJWT, deleteScene)
router.post('/scenes/:id/run', authenticateJWT, runScene)

module.exports = router
