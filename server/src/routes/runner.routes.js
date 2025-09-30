const express = require('express')
const { authenticateJWT, authenticateRunner } = require('../middleware/auth')
const { createRunner, listRunners, runnerHeartbeat} = require('../controllers/runner.controller')
const router = express.Router()

router.post('/runners/register', authenticateJWT, createRunner)
router.get('/runners', authenticateJWT, listRunners)
router.post('/runners/heartbeat', authenticateRunner, runnerHeartbeat)

module.exports = router