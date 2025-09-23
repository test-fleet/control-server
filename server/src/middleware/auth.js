// middleware/auth.js
const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const { UnauthorizedError, ForbiddenError, NotFoundError } = require('../utils/appError')

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

    if (user.status === 'disabled') {
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

module.exports = { authenticateJWT }
