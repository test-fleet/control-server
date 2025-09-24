const express = require('express')
const { authenticateJWT } = require('../middleware/auth')
const { inviteUser, listUsers, editRole, editStatus, deleteUser } = require('../controllers/user.controller')

const router = express.Router()

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.get('/users', authenticateJWT, listUsers)

/**
 * @swagger
 * /api/v1/users/invite:
 *   post:
 *     summary: Invite new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               role:
 *                 type: string
 *                 example: admin
 *           example:
 *             email: "user@example.com"
 *             role: "admin"
 *     responses:
 *       201:
 *         description: User invited successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authenticated
 */
router.post('/users/invite', authenticateJWT, inviteUser)

/**
 * @swagger
 * /api/v1/users/{id}/role:
 *   put:
 *     summary: Change user role
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 example: admin
 *           example:
 *             role: "admin"
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
router.put('/users/:id/role', authenticateJWT, editRole)

/**
 * @swagger
 * /api/v1/users/{id}/status:
 *   put:
 *     summary: Enable/disable user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: 
 *           example:
 *             status: "deactivated"
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
router.put('/users/:id/status', authenticateJWT, editStatus)

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       204:
 *         description: User deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
router.delete('/users/:id', authenticateJWT, deleteUser)

module.exports = router