const Scene = require('../models/scene.model')
const Frame = require('../models/frame.model')

// Fixed id so we can idempotently detect the sample scene across restarts
const SAMPLE_SCENE_ID = 'scene_sample_jsonplaceholder'

async function bootstrapSampleScene() {
  try {
    await createSampleScene()
  } catch (err) {
    console.error('[bootstrap] failed to create sample scene:', err)
  }
}

async function createSampleScene() {
  const existing = await Scene.findOne({ id: SAMPLE_SCENE_ID })
  if (existing) {
    console.log('[bootstrap] Sample scene already exists')
    return
  }

  await Scene.create({
    id: SAMPLE_SCENE_ID,
    name: 'Sample: JSONPlaceholder chain',
    description:
      'Example scene against the public JSONPlaceholder API. Chains a post ' +
      "→ its author → its comments → the author's todos → a new post, " +
      'threading extracted values through ${variable} references across ' +
      'frames. Safe to edit or delete.',
    variables: {
      requestedBy: { type: 'string', value: 'testfleet-bootstrap' },
    },
    frameIds: [],
    timeout: 30000,
    cronSchedule: '0 0 * * *',
    orgId: 'internal',
    enabled: false, // demo only — flip on in the UI if you want it scheduled
    createdBy: 'server',
  })

  const frameDefs = [
    {
      // Seeds postUserId/postId/contentType for every later frame in the chain.
      name: '1. Get post #1',
      request: {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        headers: { 'X-Requested-By': '${requestedBy}' },
      },
      extractors: [
        { name: 'postId', type: 'json', source: '$.id', dataType: 'number' },
        { name: 'postUserId', type: 'json', source: '$.userId', dataType: 'number' },
        { name: 'contentType', type: 'header', source: 'Content-Type', dataType: 'string' },
      ],
      assertions: [
        { type: 'status', operator: 'eq', expected: 200, source: 'status' },
        { type: 'body', operator: 'eq', expected: 1, source: '$.id' },
      ],
    },
    {
      // URL built from frame 1's postUserId; header built from frame 1's
      // extracted response header, showing both URL- and header-variable use.
      name: "2. Get the post's author",
      request: {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/users/${postUserId}',
        headers: { 'X-Debug-Upstream-Content-Type': '${contentType}' },
      },
      extractors: [
        { name: 'userEmail', type: 'json', source: '$.email', dataType: 'string' },
        { name: 'userName', type: 'json', source: '$.username', dataType: 'string' },
        { name: 'userCity', type: 'json', source: '$.address.city', dataType: 'string' },
      ],
      assertions: [
        { type: 'status', operator: 'eq', expected: 200, source: 'status' },
        { type: 'body', operator: 'gt', expected: 0, source: '$.id' },
        { type: 'body', operator: 'contains', expected: '@', source: '$.email' },
      ],
    },
    {
      // Query param built from frame 1's postId.
      name: "3. Get the post's comments",
      request: {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/comments?postId=${postId}',
      },
      extractors: [
        { name: 'firstCommentEmail', type: 'json', source: '$.[0].email', dataType: 'string' },
      ],
      assertions: [
        { type: 'status', operator: 'eq', expected: 200, source: 'status' },
        { type: 'body', operator: 'eq', expected: 1, source: '$.[0].postId' },
      ],
    },
    {
      // Query param built from frame 1's postUserId.
      name: "4. Get the author's todos",
      request: {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/todos?userId=${postUserId}',
      },
      extractors: [
        { name: 'firstTodoTitle', type: 'json', source: '$.[0].title', dataType: 'string' },
      ],
      assertions: [
        { type: 'status', operator: 'eq', expected: 200, source: 'status' },
        { type: 'body', operator: 'eq', expected: 1, source: '$.[0].userId' },
      ],
    },
    {
      // JSON body built from values extracted in frames 1, 3, and 4 —
      // demonstrates ${var} substitution inside a request body, including
      // an unquoted numeric placeholder next to a quoted string placeholder.
      name: '5. Create a follow-up post',
      request: {
        method: 'POST',
        url: 'https://jsonplaceholder.typicode.com/posts',
        headers: { 'Content-Type': 'application/json' },
        body:
          '{"title": "${firstCommentEmail}", ' +
          '"body": "${firstTodoTitle}", ' +
          '"userId": ${postUserId}}',
      },
      extractors: [],
      assertions: [
        { type: 'status', operator: 'eq', expected: 201, source: 'status' },
        { type: 'body', operator: 'eq', expected: 101, source: '$.id' },
      ],
    },
  ]

  const frameIds = []
  for (let i = 0; i < frameDefs.length; i++) {
    const def = frameDefs[i]
    const frame = await Frame.create({
      sceneId: SAMPLE_SCENE_ID,
      name: def.name,
      order: i,
      enabled: true,
      request: def.request,
      extractors: def.extractors,
      assertions: def.assertions,
    })
    frameIds.push(frame._id.toString())
  }

  await Scene.findOneAndUpdate({ id: SAMPLE_SCENE_ID }, { $set: { frameIds } })
  console.log(`[bootstrap] Sample scene created with ${frameIds.length} frames`)
}

module.exports = { bootstrapSampleScene }
