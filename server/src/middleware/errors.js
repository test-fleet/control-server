const { AppError } = require('../utils/appError')

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message
    })
  }

  console.error(err)
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Something went wrong'
  })
}

module.exports = errorHandler
