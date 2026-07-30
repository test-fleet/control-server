// Shared "is this runner actually alive" check — used both by the dashboard
// (offline count/alerts) and the scheduler (who to expect a report from).
function heartbeatThresholdMs() {
  const interval = parseInt(process.env.HEARTBEAT_INTERVAL) || 30000
  return interval * 3
}

function isRunnerUnresponsive(runner, thresholdMs = heartbeatThresholdMs()) {
  if (!runner.lastSeen) return true
  return Date.now() - new Date(runner.lastSeen).getTime() > thresholdMs
}

module.exports = { heartbeatThresholdMs, isRunnerUnresponsive }
