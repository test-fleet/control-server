class AppError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
    this.name = this.constructor.name
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400)
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404)
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409)
  }
}

class UnauthorizedError extends AppError {
  constructor(message) {
    super(message, 401)
  }
}

class ForbiddenError extends AppError {
  constructor(message) {
    super(message, 403)
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError
}