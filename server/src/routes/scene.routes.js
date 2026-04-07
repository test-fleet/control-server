const express = require('express')
const { authenticateJWT } = require('../middleware/auth')
const { createScene, listAllScenes, listScene, updateScene, deleteScene } = require('../controllers/scene.controller')

const router = express.Router()

router.post('/scene', authenticateJWT, createScene)
router.get('/scenes', authenticateJWT, listAllScenes)
router.get('/scene/:id', authenticateJWT, listScene)
router.put('/scene', authenticateJWT, updateScene)
router.delete('/scene', authenticateJWT, deleteScene)

module.exports = router