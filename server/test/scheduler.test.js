const { expect } = require('chai')
const { _buildPayload } = require('../src/utils/scheduler')

function makeScene(overrides = {}) {
  return {
    id: 'scene_test_001',
    name: 'Health Check',
    description: 'Smoke test',
    variables: new Map([
      ['apiKey', { type: 'string', value: 'abc123' }],
      ['retries', { type: 'number', value: 3 }],
    ]),
    frameIds: ['frame_1'],
    timeout: 30000,
    orgId: 'org_internal',
    cronSchedule: '3/10 * * * *',
    enabled: true,
    createdBy: 'user_admin',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeFrame(overrides = {}) {
  return {
    _id: { toString: () => 'frame_1' },
    sceneId: 'scene_test_001',
    name: 'GET /health',
    order: 0,
    enabled: true,
    request: {
      method: 'GET',
      url: 'https://api.example.com/health',
      headers: new Map([['X-Api-Key', 'secret']]),
      body: '',
      timeout: 5000,
    },
    extractors: [
      { name: 'status', type: 'json', source: '$.status', dataType: 'string' },
    ],
    assertions: [
      { type: 'status', operator: 'eq', expected: '200', source: 'status' },
      { type: 'json', operator: 'eq', expected: 'ok', source: '$.status' },
    ],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }
}

describe('scheduler._buildPayload', () => {
  describe('payload structure', () => {
    it('returns an object with all required top-level fields', () => {
      const payload = _buildPayload(makeScene(), [makeFrame()])
      expect(payload).to.have.all.keys(['jobId', 'type', 'runId', 'createdAt', 'scene', 'frames'])
    })

    it('sets type to "scene"', () => {
      expect(_buildPayload(makeScene(), []).type).to.equal('scene')
    })

    it('prefixes jobId with "job_"', () => {
      expect(_buildPayload(makeScene(), []).jobId).to.match(/^job_/)
    })

    it('prefixes runId with "run_"', () => {
      expect(_buildPayload(makeScene(), []).runId).to.match(/^run_/)
    })

    it('generates unique jobIds on each call', () => {
      const a = _buildPayload(makeScene(), [])
      const b = _buildPayload(makeScene(), [])
      expect(a.jobId).to.not.equal(b.jobId)
    })

    it('createdAt is a valid ISO 8601 string', () => {
      const { createdAt } = _buildPayload(makeScene(), [])
      expect(new Date(createdAt).toISOString()).to.equal(createdAt)
    })
  })

  describe('scene mapping', () => {
    it('copies all expected scene fields', () => {
      const scene = makeScene()
      const { scene: s } = _buildPayload(scene, [])
      expect(s.id).to.equal(scene.id)
      expect(s.name).to.equal(scene.name)
      expect(s.description).to.equal(scene.description)
      expect(s.timeout).to.equal(scene.timeout)
      expect(s.orgId).to.equal(scene.orgId)
      expect(s.cronSchedule).to.equal(scene.cronSchedule)
      expect(s.enabled).to.equal(scene.enabled)
      expect(s.createdBy).to.equal(scene.createdBy)
    })

    it('maps variables Map to a plain object', () => {
      const { scene: s } = _buildPayload(makeScene(), [])
      expect(s.variables).to.deep.equal({
        apiKey: { type: 'string', value: 'abc123' },
        retries: { type: 'number', value: 3 },
      })
    })

    it('handles a scene with no variables', () => {
      const scene = makeScene({ variables: undefined })
      const { scene: s } = _buildPayload(scene, [])
      expect(s.variables).to.deep.equal({})
    })

    it('handles a scene with an empty variables Map', () => {
      const scene = makeScene({ variables: new Map() })
      const { scene: s } = _buildPayload(scene, [])
      expect(s.variables).to.deep.equal({})
    })

    it('includes createdAt and updatedAt as ISO strings', () => {
      const scene = makeScene()
      const { scene: s } = _buildPayload(scene, [])
      expect(s.createdAt).to.equal(scene.createdAt.toISOString())
      expect(s.updatedAt).to.equal(scene.updatedAt.toISOString())
    })

    it('falls back gracefully when scene dates are absent', () => {
      const scene = makeScene({ createdAt: undefined, updatedAt: undefined })
      const { scene: s } = _buildPayload(scene, [])
      // should not throw; dates fall back to payload createdAt
      expect(s.createdAt).to.be.a('string')
    })
  })

  describe('frame mapping', () => {
    it('returns an empty frames array when no frames are provided', () => {
      expect(_buildPayload(makeScene(), []).frames).to.deep.equal([])
    })

    it('maps each frame to the expected shape', () => {
      const frame = makeFrame()
      const { frames } = _buildPayload(makeScene(), [frame])
      expect(frames).to.have.length(1)
      const f = frames[0]
      expect(f.frameId).to.equal('frame_1')
      expect(f.sceneId).to.equal(frame.sceneId)
      expect(f.name).to.equal(frame.name)
      expect(f.order).to.equal(frame.order)
      expect(f.enabled).to.equal(frame.enabled)
    })

    it('converts the request headers Map to a plain object', () => {
      const { frames } = _buildPayload(makeScene(), [makeFrame()])
      expect(frames[0].request.headers).to.deep.equal({ 'X-Api-Key': 'secret' })
    })

    it('copies method, url, and body from the request', () => {
      const { frames } = _buildPayload(makeScene(), [makeFrame()])
      const r = frames[0].request
      expect(r.method).to.equal('GET')
      expect(r.url).to.equal('https://api.example.com/health')
      expect(r.body).to.equal('')
    })

    it('uses frame request timeout', () => {
      const { frames } = _buildPayload(makeScene(), [makeFrame()])
      expect(frames[0].timeout).to.equal(5000)
    })

    it('falls back to 30000ms timeout when request.timeout is absent', () => {
      const frame = makeFrame({ request: { ...makeFrame().request, timeout: undefined } })
      const { frames } = _buildPayload(makeScene(), [frame])
      expect(frames[0].timeout).to.equal(30000)
    })
  })

  describe('assertion type mapping', () => {
    it('maps assertion type "json" → "body"', () => {
      const { frames } = _buildPayload(makeScene(), [makeFrame()])
      const jsonAssertion = frames[0].assertions.find(a => a.type === 'body')
      expect(jsonAssertion).to.exist
      expect(jsonAssertion.source).to.equal('$.status')
    })

    it('preserves assertion type "status" unchanged', () => {
      const { frames } = _buildPayload(makeScene(), [makeFrame()])
      const statusAssertion = frames[0].assertions.find(a => a.type === 'status')
      expect(statusAssertion).to.exist
    })

    it('handles frames with no assertions', () => {
      const frame = makeFrame({ assertions: [] })
      const { frames } = _buildPayload(makeScene(), [frame])
      expect(frames[0].assertions).to.deep.equal([])
    })

    it('handles frames with no extractors', () => {
      const frame = makeFrame({ extractors: [] })
      const { frames } = _buildPayload(makeScene(), [frame])
      expect(frames[0].extractors).to.deep.equal([])
    })
  })

  describe('multi-frame ordering', () => {
    it('preserves frame order as provided', () => {
      const f1 = makeFrame({ _id: { toString: () => 'f1' }, name: 'First', order: 0 })
      const f2 = makeFrame({ _id: { toString: () => 'f2' }, name: 'Second', order: 1 })
      const { frames } = _buildPayload(makeScene(), [f1, f2])
      expect(frames[0].name).to.equal('First')
      expect(frames[1].name).to.equal('Second')
    })
  })
})
