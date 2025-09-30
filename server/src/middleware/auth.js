// middleware/auth.js
const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const Runner = require('../models/runner.model')
const { UnauthorizedError, ForbiddenError, NotFoundError } = require('../utils/appError')
const { STATUS, ROLES } = require('../utils/constants')
const { decryptSecret } = require('../utils/crypto')
const crypto = require('crypto')

async function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization']
  if (!authHeader) {
    return next(new UnauthorizedError('Authorization header missing'))
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return next(new UnauthorizedError('Bearer token missing'))
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(payload.id)
    if (!user) {
      return next(new NotFoundError('User not found'))
    }

    if (user.status === STATUS.DISABLED) {
      return next(new ForbiddenError('Account is disabled'))
    }

    req.user = user
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'))
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token'))
    }
    return next(err)
  }
}

const TIMESTAMP_TOLERANCE_MS = 2 * 60 * 1000 // 2 min

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

async function authenticateRunner(req, res, next) {
  try {
    const auth = req.headers['authorization']
    const ts = req.headers['x-request-timestamp'] // ISO ts
    const signature = req.headers['signature'] // canonical hash using runner secret

    if (!auth || !ts || !signature) {
      return next(new UnauthorizedError('Missing auth headers'))
    }

    const [scheme, keyId] = auth.split(' ')
    if (scheme != 'ApiKey') {
      return next(new UnauthorizedError('Invalid auth header'))
    }

    const runner = await Runner.findOne({ keyId: keyId })
    if (!runner || runner.status == 'disabled') {
      return next(new UnauthorizedError('Unknown or disabled runner'))
    }

    const t = Date.parse(ts)
    if (Number.isNaN(t)) {
      return next(new UnauthorizedError('Invalid timestamp'))
    }

    const now = Date.now()
    if (Math.abs(now - t) > TIMESTAMP_TOLERANCE_MS) {
      return next(new UnauthorizedError('Timestamp out of range'))
    }

    const secret = await decryptSecret(runner.encryptedSecret)

    const method = req.method.toUpperCase()
    const path = req.originalUrl.split('?')[0]
    const body = (req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : '')
    const canonical = `${ts}.${method}.${path}.${body}`

    const h = crypto.createHmac('sha256', secret).update(canonical).digest('hex')

    const [alg, incoming] = signature.split('=')

    if (alg !== 'sha256' || !incoming) {
      return next(new UnauthorizedError('Invalid header signature'))
    }

    if (!timingSafeEqual(h, incoming)) {
      return next(new UnauthorizedError('Invalid Signature'))
    }

    req.runner = {
      id: runner._id,
      keyId: runner.keyId,
      meta: runner.metadata
    }
    
    return next()
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

module.exports = {
  authenticateJWT,
  authenticateRunner
}
