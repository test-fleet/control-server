const { expect } = require('chai')
const sinon = require('sinon')
const errorHandler = require('../../src/middleware/errors')
const { AppError, ValidationError, NotFoundError, UnauthorizedError } = require('../../src/utils/appError')

function makeRes() {
  const res = {}
  res.status = sinon.stub().returns(res)
  res.json = sinon.stub().returns(res)
  return res
}

describe('errorHandler middleware', () => {
  let req, next

  beforeEach(() => {
    req = {}
    next = sinon.stub()
  })

  it('responds with AppError statusCode and structured body', () => {
    const res = makeRes()
    const err = new ValidationError('name is required')

    errorHandler(err, req, res, next)

    expect(res.status.calledWith(400)).to.be.true
    expect(res.json.calledOnce).to.be.true
    const body = res.json.firstCall.args[0]
    expect(body.error).to.equal('ValidationError')
    expect(body.message).to.equal('name is required')
  })

  it('handles NotFoundError with 404', () => {
    const res = makeRes()
    errorHandler(new NotFoundError('scene not found'), req, res, next)
    expect(res.status.calledWith(404)).to.be.true
    expect(res.json.firstCall.args[0].error).to.equal('NotFoundError')
  })

  it('handles UnauthorizedError with 401', () => {
    const res = makeRes()
    errorHandler(new UnauthorizedError('bad token'), req, res, next)
    expect(res.status.calledWith(401)).to.be.true
  })

  it('falls back to 500 for non-AppError exceptions', () => {
    const res = makeRes()
    errorHandler(new Error('db exploded'), req, res, next)
    expect(res.status.calledWith(500)).to.be.true
    const body = res.json.firstCall.args[0]
    expect(body.error).to.equal('InternalServerError')
    expect(body.message).to.equal('Something went wrong')
  })
})
