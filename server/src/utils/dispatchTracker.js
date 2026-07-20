// Ephemeral in-memory record of recently-dispatched scene runs, keyed by
// runId. Populated by the scheduler at the moment a job is published to
// Redis — this is the only place "a run was just queued" is knowable, since
// no SceneResult document exists until a runner reports back.
//
// Used by the dashboard summary endpoint to show in-flight/just-finished
// activity. Entries are pruned after TTL_MS; does not survive restarts,
// which is fine — it's a "what just happened" feed, not a source of truth.

const dispatches = new Map()
const TTL_MS = 10 * 60 * 1000 // 10 min — comfortably longer than any realistic scene timeout

function recordDispatch({ runId, sceneId, sceneName, expectedRunners }) {
  dispatches.set(runId, { runId, sceneId, sceneName, expectedRunners, dispatchedAt: new Date() })
  setTimeout(() => dispatches.delete(runId), TTL_MS).unref()
}

function listRecentDispatches() {
  return [...dispatches.values()].sort((a, b) => b.dispatchedAt - a.dispatchedAt)
}

module.exports = { recordDispatch, listRecentDispatches }
