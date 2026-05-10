// Ephemeral cache mapping runId → expectedRunners, populated at dispatch time.
// Entries expire after 2 hours (longer than any reasonable scene timeout).
// Does not survive restarts, which is fine — the pipeline heuristic handles stale DB data.

const cache = new Map()
const TTL_MS = 2 * 60 * 60 * 1000

function setJobExpectedRunners(runId, expectedRunners) {
  cache.set(runId, expectedRunners)
  setTimeout(() => cache.delete(runId), TTL_MS).unref()
}

function getJobExpectedRunners(runId) {
  return cache.get(runId) ?? null
}

module.exports = { setJobExpectedRunners, getJobExpectedRunners }
