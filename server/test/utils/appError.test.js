const { expect } = require('chai')
const {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} = require('../../src/utils/appError')

describe('AppError', () => {
  it('stores message and statusCode', () => {
    const err = new AppError('something failed', 500)
    expect(err.message).to.equal('something failed')
    expect(err.statusCode).to.equal(500)
  })

  it('sets name to the constructor name', () => {
    const err = new AppError('test', 400)
    expect(err.name).to.equal('AppError')
  })

  it('is an instance of Error', () => {
    expect(new AppError('x', 500)).to.be.instanceOf(Error)
  })
})

describe('ValidationError', () => {
  it('uses status 400', () => {
    const err = new ValidationError('bad input')
    expect(err.statusCode).to.equal(400)
    expect(err.message).to.equal('bad input')
    expect(err.name).to.equal('ValidationError')
  })

  it('is an instance of AppError', () => {
    expect(new ValidationError('x')).to.be.instanceOf(AppError)
  })
})

describe('NotFoundError', () => {
  it('uses status 404', () => {
    const err = new NotFoundError('not found')
    expect(err.statusCode).to.equal(404)
    expect(err.name).to.equal('NotFoundError')
  })
})

describe('ConflictError', () => {
  it('uses status 409', () => {
    const err = new ConflictError('conflict')
    expect(err.statusCode).to.equal(409)
    expect(err.name).to.equal('ConflictError')
  })
})

describe('UnauthorizedError', () => {
  it('uses status 401', () => {
    const err = new UnauthorizedError('unauthorized')
    expect(err.statusCode).to.equal(401)
    expect(err.name).to.equal('UnauthorizedError')
  })
})

describe('ForbiddenError', () => {
  it('uses status 403', () => {
    const err = new ForbiddenError('forbidden')
    expect(err.statusCode).to.equal(403)
    expect(err.name).to.equal('ForbiddenError')
  })
})
