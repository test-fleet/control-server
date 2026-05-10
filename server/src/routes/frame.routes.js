const express = require('express')
const { authenticateJWT } = require('../middleware/auth')
const frameController = require('../controllers/frame.controller')

const router = express.Router()

/**
 * @openapi
 * /scenes/{sceneId}/frames:
 *   post:
 *     tags:
 *       - Frames
 *     summary: Create a frame
 *     description: Adds a new HTTP request frame to a scene. Frames are executed in order during a scene run.
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
 *           example: scene_1700000000000_ab12cd34
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - request
 *             properties:
 *               name:
 *                 type: string
 *                 example: Check Health Endpoint
 *               enabled:
 *                 type: boolean
 *                 example: true
 *               request:
 *                 type: object
 *                 required:
 *                   - method
 *                   - url
 *                 properties:
 *                   method:
 *                     type: string
 *                     enum: [GET, POST, PUT, PATCH, DELETE]
 *                     example: GET
 *                   url:
 *                     type: string
 *                     example: https://api.example.com/health
 *                   headers:
 *                     type: object
 *                     example: { "Content-Type": "application/json" }
 *                   body:
 *                     type: string
 *                     example: '{"key":"value"}'
 *                   timeout:
 *                     type: integer
 *                     example: 30000
 *               extractors:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: authToken
 *                     type:
 *                       type: string
 *                       enum: [json, header]
 *                       example: json
 *                     source:
 *                       type: string
 *                       example: $.data.token
 *                     dataType:
 *                       type: string
 *                       enum: [string, number, boolean, null]
 *                       example: string
 *               assertions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [status, json, header]
 *                       example: status
 *                     operator:
 *                       type: string
 *                       enum: [eq, ne, gt, gte, lt, lte, contains, matches]
 *                       example: eq
 *                     expected:
 *                       example: 200
 *                     source:
 *                       type: string
 *                       example: status
 *     responses:
 *       201:
 *         description: Frame created successfully
 *       400:
 *         description: Validation error — missing required fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Scene not found
 */
router.post('/frames/test', authenticateJWT, frameController.testFrame)

router.post('/scenes/:sceneId/frames', authenticateJWT, frameController.createFrame)

/**
 * @openapi
 * /scenes/{sceneId}/frames:
 *   get:
 *     tags:
 *       - Frames
 *     summary: List frames for a scene
 *     description: Returns all frames belonging to a scene, sorted by their execution order.
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
 *           example: scene_1700000000000_ab12cd34
 *     responses:
 *       200:
 *         description: Frames retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Scene not found
 */
router.get('/scenes/:sceneId/frames', authenticateJWT, frameController.listFrames)

/**
 * @openapi
 * /scenes/{sceneId}/frames/reorder:
 *   put:
 *     tags:
 *       - Frames
 *     summary: Reorder frames
 *     description: Sets the execution order of frames within a scene by providing the full ordered list of frame IDs.
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
 *           example: scene_1700000000000_ab12cd34
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - frameIds
 *             properties:
 *               frameIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["6761a2b3c4d5e6f7a8b9c0d1", "6761a2b3c4d5e6f7a8b9c0d2"]
 *     responses:
 *       200:
 *         description: Frames reordered successfully
 *       400:
 *         description: Validation error — frameIds must be an array
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Scene not found
 */
// reorder must be registered before /:frameId to avoid Express matching "reorder" as a frameId
router.put('/scenes/:sceneId/frames/reorder', authenticateJWT, frameController.reorderFrames)

/**
 * @openapi
 * /scenes/{sceneId}/frames/{frameId}:
 *   put:
 *     tags:
 *       - Frames
 *     summary: Update a frame
 *     description: Updates the name, request configuration, extractors, or assertions of an existing frame.
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
 *           example: scene_1700000000000_ab12cd34
 *       - in: path
 *         name: frameId
 *         required: true
 *         schema:
 *           type: string
 *           example: 6761a2b3c4d5e6f7a8b9c0d1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Check Auth Token
 *               enabled:
 *                 type: boolean
 *                 example: true
 *               request:
 *                 type: object
 *                 properties:
 *                   method:
 *                     type: string
 *                     enum: [GET, POST, PUT, PATCH, DELETE]
 *                   url:
 *                     type: string
 *                   body:
 *                     type: string
 *                   timeout:
 *                     type: integer
 *               extractors:
 *                 type: array
 *                 items:
 *                   type: object
 *               assertions:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Frame updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Frame not found
 */
router.put('/scenes/:sceneId/frames/:frameId', authenticateJWT, frameController.updateFrame)

/**
 * @openapi
 * /scenes/{sceneId}/frames/{frameId}:
 *   delete:
 *     tags:
 *       - Frames
 *     summary: Delete a frame
 *     description: Permanently removes a frame from a scene and updates the scene's frame list.
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
 *           example: scene_1700000000000_ab12cd34
 *       - in: path
 *         name: frameId
 *         required: true
 *         schema:
 *           type: string
 *           example: 6761a2b3c4d5e6f7a8b9c0d1
 *     responses:
 *       200:
 *         description: Frame deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Frame not found
 */
router.delete('/scenes/:sceneId/frames/:frameId', authenticateJWT, frameController.deleteFrame)

/**
 * @openapi
 * /scenes/{sceneId}/frames/{frameId}:
 *   get:
 *     tags:
 *       - Frames
 *     summary: Get a single frame
 *     description: Retrieves the full details of a specific frame by its ID.
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
 *           example: scene_1700000000000_ab12cd34
 *       - in: path
 *         name: frameId
 *         required: true
 *         schema:
 *           type: string
 *           example: 6761a2b3c4d5e6f7a8b9c0d1
 *     responses:
 *       200:
 *         description: Frame retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Frame not found
 */
router.get('/scenes/:sceneId/frames/:frameId', authenticateJWT)

module.exports = router
