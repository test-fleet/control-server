const multer = require('multer')
const { AppError } = require('../utils/appError')

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message
    })
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2MB or smaller' : err.message
    return res.status(400).json({
      error: 'ValidationError',
      message
    })
  }

  console.error(err)
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Something went wrong'
  })
}

module.exports = errorHandler
