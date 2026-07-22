// Shared scene/frame helpers used by the Scenes list page and the Scene
// detail views. Kept in one place because the cron <-> frequency conversion
// and the res.body./$.  path translation both have to exactly match what the
// backend and the test-runner expect.

export const FREQUENCY_OPTIONS = [
  { label: '1 minute',   value: 1    },
  { label: '5 minutes',  value: 5    },
  { label: '10 minutes', value: 10   },
  { label: '15 minutes', value: 15   },
  { label: '30 minutes', value: 30   },
  { label: '1 hour',     value: 60   },
  { label: '3 hours',    value: 180  },
  { label: '6 hours',    value: 360  },
  { label: '12 hours',   value: 720  },
  { label: '24 hours',   value: 1440 },
]

// node-cron's validator (unlike Vixie cron) rejects step fields anchored at a
// non-zero offset, e.g. "1/5 * * * *" or "30 1/3 * * *" both fail
// cron.validate() even though they're valid POSIX cron. An explicit
// comma-separated value list is accepted and preserves the same anchor.
function buildStepList(anchor, step, max) {
  const values = []
  for (let v = anchor; v < max; v += step) values.push(v)
  return values.join(',')
}

export function buildCronSchedule(frequencyMinutes, createdAt = new Date()) {
  const now = new Date(createdAt)
  const minute = now.getMinutes()
  const hour = now.getHours()

  if (frequencyMinutes === 1) return '* * * * *'

  if (frequencyMinutes < 60) {
    const anchor = minute % frequencyMinutes
    return `${buildStepList(anchor, frequencyMinutes, 60)} * * * *`
  }

  if (frequencyMinutes === 60) {
    return `${minute} * * * *`
  }

  if (frequencyMinutes === 1440) {
    return `${minute} ${hour} * * *`
  }

  // 3h, 6h, 12h — anchor to creation hour so firing pattern is consistent
  const hourFreq = Math.floor(frequencyMinutes / 60)
  const anchorHour = hour % hourFreq
  return `${minute} ${buildStepList(anchorHour, hourFreq, 24)} * * *`
}

// Extracts the step size from either a comma list ("1,6,11,...") or the
// classic "N/step" form (kept for backward compat with any cron strings
// saved before the list-based format above, or entered by hand).
function stepFromField(field) {
  if (field.includes(',')) {
    const nums = field.split(',').map(Number)
    return nums.length >= 2 ? nums[1] - nums[0] : null
  }
  if (field.includes('/')) {
    return parseInt(field.split('/')[1], 10)
  }
  return null
}

export function detectFrequency(cron) {
  if (!cron) return 5
  const trimmed = cron.trim()
  if (trimmed === '* * * * *') return 1

  const parts = trimmed.split(' ')
  const minPart = parts[0]
  const hourPart = parts[1]

  if (hourPart === '*') {
    const minStep = stepFromField(minPart)
    if (minStep) return minStep
    return 60
  }

  const hourStep = stepFromField(hourPart)
  if (hourStep) return hourStep * 60

  return 1440
}

export function frequencyLabel(cron) {
  return FREQUENCY_OPTIONS.find(o => o.value === detectFrequency(cron))?.label ?? cron ?? '—'
}

export const THRESHOLD_OPTIONS = [
  { label: 'All runners',  value: 1.0, hint: 'Every active runner must pass' },
  { label: 'Majority',     value: 0.5, hint: '50% or more must pass' },
  { label: 'Any runner',   value: 0.0, hint: 'At least one runner must pass' },
]

export function thresholdLabel(t) {
  if (t == null || t >= 1.0) return 'All runners must pass'
  if (t >= 0.5) return '≥50% of runners must pass'
  return 'At least 1 runner must pass'
}

export function formatTimeout(ms) {
  if (!ms) return '—'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ── res.body.x <-> $.x path translation ──────────────────────────────────
// The UI shows the friendlier "res.body.x" form; the API/runner expect the
// JSONPath form "$.x". Keeping this in one place matters: a hand-written
// mismatch here is exactly the bug that made assertions silently no-op
// against the raw response body instead of doing a JSONPath lookup.

export function toApiPath(displayPath) {
  if (!displayPath) return ''
  if (displayPath.startsWith('res.body.')) return '$.' + displayPath.slice(9)
  if (displayPath === 'res.body') return '$'
  return displayPath
}

export function toDisplayPath(apiPath) {
  if (!apiPath) return ''
  if (apiPath.startsWith('$.')) return 'res.body.' + apiPath.slice(2)
  if (apiPath === '$') return 'res.body'
  return apiPath
}

export function frameToFormValues(frame) {
  return {
    name: frame.name || '',
    enabled: frame.enabled ?? true,
    method: frame.request?.method || 'GET',
    url: frame.request?.url || '',
    body: frame.request?.body || '',
    timeout: frame.request?.timeout ? Math.floor(frame.request.timeout / 1000) : 30,
    headers: Object.entries(frame.request?.headers || {}).map(([key, value]) => ({ key, value })),
    extractors: (frame.extractors || []).map(ex => ({
      ...ex,
      source: ex.type === 'json' ? toDisplayPath(ex.source) : ex.source,
    })),
    assertions: (frame.assertions || []).map(as => ({
      ...as,
      source: as.type === 'status' ? '' : (as.type === 'json' ? toDisplayPath(as.source) : as.source),
    })),
  }
}

export function transformFrameForApi(frame) {
  return {
    extractors: (frame.extractors || []).map(ex => ({
      ...ex,
      source: ex.type === 'json' ? toApiPath(ex.source) : ex.source,
    })),
    assertions: (frame.assertions || []).map(as => ({
      ...as,
      source: as.type === 'status' ? 'status' : (as.type === 'json' ? toApiPath(as.source) : as.source),
    })),
    headers: (frame.headers || []).reduce((acc, h) => {
      if (h.key?.trim()) acc[h.key.trim()] = h.value ?? ''
      return acc
    }, {}),
  }
}

// Resolves ${variable} placeholders using values known so far (scene
// variables plus anything extracted by earlier frames), mirroring the
// runner's own substitution so "Test frame" reflects what a real run would
// actually send instead of the literal ${var} string.
export function resolveVariables(text, knownVars) {
  if (!text) return text
  return text.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, name) => {
    if (!(name in knownVars)) return match
    const v = knownVars[name]
    return v === null || v === undefined ? '' : String(v)
  })
}

export function unresolvedVariables(text, knownVars) {
  if (!text) return []
  const found = new Set()
  const re = /\$\{([A-Za-z0-9_]+)\}/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (!(m[1] in knownVars)) found.add(m[1])
  }
  return [...found]
}

// Pretty-prints a JSON request body that may contain ${var} placeholders
// either inside a string ("${token}") or bare in a numeric/boolean position
// (${count}) — both are valid here since resolveVariables does plain text
// substitution, but bare placeholders aren't valid JSON on their own. Each
// placeholder is swapped for a same-width numeric sentinel (valid JSON in
// both positions) before parsing, then swapped back after JSON.stringify.
// Returns null if the body isn't parseable JSON even with that substitution.
export function formatJsonBody(raw) {
  if (!raw || !raw.trim()) return raw

  const tokens = []
  const withSentinels = raw.replace(/\$\{[A-Za-z0-9_]+\}/g, (match) => {
    const sentinel = `-9${String(tokens.length).padStart(6, '0')}`
    tokens.push({ sentinel, match })
    return sentinel
  })

  let parsed
  try {
    parsed = JSON.parse(withSentinels)
  } catch {
    return null
  }

  let formatted = JSON.stringify(parsed, null, 2)
  for (const { sentinel, match } of tokens) {
    formatted = formatted.split(sentinel).join(match)
  }
  return formatted
}
