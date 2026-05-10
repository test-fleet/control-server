const { expect } = require('chai')
const sinon = require('sinon')
const jwt = require('jsonwebtoken')
const User = require('../../src/models/user.model')
const Runner = require('../../src/models/runner.model')
const crypto = require('crypto')

// Load auth after the dependencies are in the require cache so sinon stubs work
const { authenticateJWT, authenticateRunner } = require('../../src/middleware/auth')

const TEST_SECRET = 'test-secret-key'

function makeNext() { return sinon.stub() }

function makeRes() {
  const res = {}
  res.status = sinon.stub().returns(res)
  res.json = sinon.stub().returns(res)
  return res
}

// ── authenticateJWT ────────────────────────────────────────────────────────────

describe('authenticateJWT', () => {
  let jwtVerifyStub, userFindStub

  beforeEach(() => {
    jwtVerifyStub = sinon.stub(jwt, 'verify')
    userFindStub = sinon.stub(User, 'findById')
  })

  afterEach(() => {
    sinon.restore()
  })

  it('calls next with UnauthorizedError when Authorization header is missing', async () => {
    const req = { headers: {} }
    const next = makeNext()
    await authenticateJWT(req, makeRes(), next)
    expect(next.calledOnce).to.be.true
    const err = next.firstCall.args[0]
    expect(err).to.have.property('statusCode', 401)
  })

  it('calls next with UnauthorizedError when Bearer token is missing', async () => {
    const req = { headers: { authorization: 'Bearer ' } }
    const next = makeNext()
    await authenticateJWT(req, makeRes(), next)
    expect(next.calledOnce).to.be.true
    expect(next.firstCall.args[0].statusCode).to.equal(401)
  })

  it('calls next with UnauthorizedError on expired token', async () => {
    const expiredErr = new Error('token expired')
    expiredErr.name = 'TokenExpiredError'
    jwtVerifyStub.throws(expiredErr)

    const req = { headers: { authorization: 'Bearer sometoken' } }
    const next = makeNext()
    await authenticateJWT(req, makeRes(), next)

    const err = next.firstCall.args[0]
    expect(err.statusCode).to.equal(401)
    expect(err.message).to.include('expired')
  })

  it('calls next with UnauthorizedError on invalid token', async () => {
    const jwtErr = new Error('invalid')
    jwtErr.name = 'JsonWebTokenError'
    jwtVerifyStub.throws(jwtErr)

    const req = { headers: { authorization: 'Bearer badtoken' } }
    const next = makeNext()
    await authenticateJWT(req, makeRes(), next)

    expect(next.firstCall.args[0].statusCode).to.equal(401)
  })

  it('calls next with NotFoundError when user does not exist', async () => {
    jwtVerifyStub.returns({ id: 'user123' })
    userFindStub.resolves(null)

    const req = { headers: { authorization: 'Bearer validtoken' } }
    const next = makeNext()
    await authenticateJWT(req, makeRes(), next)

    expect(next.firstCall.args[0].statusCode).to.equal(404)
  })

  it('calls next with ForbiddenError when user is disabled', async () => {
    jwtVerifyStub.returns({ id: 'user123' })
    userFindStub.resolves({ _id: 'user123', status: 'disabled' })

    const req = { headers: { authorization: 'Bearer validtoken' } }
    const next = makeNext()
    await authenticateJWT(req, makeRes(), next)

    expect(next.firstCall.args[0].statusCode).to.equal(403)
  })

  it('attaches user to req and calls next() on success', async () => {
    const mockUser = { _id: 'user123', status: 'active', email: 'test@test.com' }
    jwtVerifyStub.returns({ id: 'user123' })
    userFindStub.resolves(mockUser)

    const req = { headers: { authorization: 'Bearer validtoken' } }
    const next = makeNext()
    await authenticateJWT(req, makeRes(), next)

    expect(next.calledWith()).to.be.true // called with no arguments = success
    expect(req.user).to.deep.equal(mockUser)
  })
})

// ── authenticateRunner ─────────────────────────────────────────────────────────

describe('authenticateRunner', () => {
  let runnerFindStub

  beforeEach(() => {
    runnerFindStub = sinon.stub(Runner, 'findOne')
  })

  afterEach(() => {
    sinon.restore()
  })

  function makeRunnerReq(overrides = {}) {
    const ts = new Date().toISOString()
    return {
      headers: {
        authorization: 'ApiKey key_abc123',
        'x-request-timestamp': ts,
        signature: 'sha256=deadbeef',
        ...overrides,
      },
      method: 'GET',
      originalUrl: '/api/v1/jobs',
      body: {},
    }
  }

  it('calls next with UnauthorizedError when auth headers are missing', async () => {
    const req = { headers: {} }
    const next = makeNext()
    await authenticateRunner(req, makeRes(), next)
    expect(next.firstCall.args[0].statusCode).to.equal(401)
  })

  it('calls next with UnauthorizedError when scheme is not ApiKey', async () => {
    const req = makeRunnerReq({ authorization: 'Bearer token' })
    const next = makeNext()
    await authenticateRunner(req, makeRes(), next)
    expect(next.firstCall.args[0].statusCode).to.equal(401)
  })

  it('calls next with UnauthorizedError when runner is not found', async () => {
    runnerFindStub.resolves(null)
    const req = makeRunnerReq()
    const next = makeNext()
    await authenticateRunner(req, makeRes(), next)
    expect(next.firstCall.args[0].statusCode).to.equal(401)
  })

  it('calls next with UnauthorizedError when timestamp is out of range', async () => {
    const oldTs = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago
    runnerFindStub.resolves({ keyId: 'key_abc123', status: 'active', encryptedSecret: 'enc' })
    const req = makeRunnerReq({ 'x-request-timestamp': oldTs })
    const next = makeNext()
    await authenticateRunner(req, makeRes(), next)
    const err = next.firstCall.args[0]
    expect(err.statusCode).to.equal(401)
    expect(err.message).to.include('Timestamp')
  })

  it('calls next with UnauthorizedError on invalid timestamp format', async () => {
    runnerFindStub.resolves({ keyId: 'key_abc123', status: 'active' })
    const req = makeRunnerReq({ 'x-request-timestamp': 'not-a-date' })
    const next = makeNext()
    await authenticateRunner(req, makeRes(), next)
    expect(next.firstCall.args[0].statusCode).to.equal(401)
  })
})
