// Mirrors (a basic subset of) the runner's real JSONPath dialect
// (github.com/oliveagle/jsonpath) closely enough for a live preview: dot
// keys and bracketed array indices, e.g. "data.items[0].id" or "[0].email"
// for a root-level array. Splitting on anything that isn't '.', '[', or ']'
// flattens both forms into the same key list, so `items[0]` and `items.0`
// resolve identically here — this is just the local test-preview shim, not
// a full JSONPath implementation.
function resolvePath(obj, path) {
  const normalized = path === '$' ? '' : path.startsWith('$.') ? path.slice(2) : path
  if (!normalized) return obj
  const keys = normalized.match(/[^.[\]]+/g) || []
  return keys.reduce((curr, key) => curr?.[key], obj)
}

function resolveActual(type, source, statusCode, headers, parsedBody) {
  if (type === 'status') return statusCode
  if (type === 'header') return headers[(source || '').toLowerCase()] ?? null
  if (type === 'json') return resolvePath(parsedBody, source || '$')
  return null
}

function evaluate(operator, actual, expected) {
  switch (operator) {
    case 'eq':       return actual == expected // loose: 200 == "200"
    case 'ne':       return actual != expected
    case 'gt':       return Number(actual) > Number(expected)
    case 'gte':      return Number(actual) >= Number(expected)
    case 'lt':       return Number(actual) < Number(expected)
    case 'lte':      return Number(actual) <= Number(expected)
    case 'contains': return String(actual ?? '').includes(String(expected ?? ''))
    default:         return false
  }
}

async function testFrame({ request, assertions = [] }) {
  const { method = 'GET', url, headers = {}, body, timeout = 30000 } = request

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  const start = Date.now()
  let statusCode, responseHeaders = {}, responseBody = '', durationMs, error

  try {
    const init = { method: method.toUpperCase(), headers, signal: controller.signal }
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      init.body = body
    }
    const res = await fetch(url, init)
    durationMs = Date.now() - start
    statusCode = res.status
    for (const [k, v] of res.headers.entries()) responseHeaders[k] = v
    responseBody = await res.text()
  } catch (err) {
    durationMs = Date.now() - start
    error = err.name === 'AbortError' ? `Request timed out after ${timeout}ms` : err.message
  } finally {
    clearTimeout(timer)
  }

  let parsedBody = null
  if (!error) {
    try { parsedBody = JSON.parse(responseBody) } catch {}
  }

  const assertionResults = assertions.map(a => {
    if (error) return { type: a.type, operator: a.operator, source: a.source ?? '', expected: a.expected, actual: null, passed: false }
    const actual = resolveActual(a.type, a.source, statusCode, responseHeaders, parsedBody)
    const passed = evaluate(a.operator, actual, a.expected)
    return { type: a.type, operator: a.operator, source: a.source ?? '', expected: a.expected, actual, passed }
  })

  const allPassed = !error && assertionResults.every(a => a.passed)

  return {
    status: error ? 'error' : (allPassed ? 'passed' : 'failed'),
    error: error ?? null,
    request: { method: method.toUpperCase(), url, headers },
    response: error ? null : {
      statusCode,
      headers: responseHeaders,
      bodySize: responseBody.length,
      durationMs,
      body: responseBody || null,
      bodyJson: parsedBody,
    },
    durationMs: durationMs ?? 0,
    assertions: assertionResults,
  }
}

module.exports = { testFrame }
