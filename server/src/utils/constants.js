const ROLES = {
  ADMIN: 'admin',
  USER: 'user'
}

const STATUS = {
  INVITED: 'invited',
  ACTIVE: 'active',
  DISABLED: 'disabled'
}

// Redis pub/sub channel used to dispatch scene jobs to runners. Not
// user-configurable: it's a shared protocol constant between this server and
// every test-runner, not a pointer to a distinct resource like REDIS_URL is.
// Must match the hardcoded value in the test-runner's internal/config/config.go.
const REDIS_CHANNEL = 'testfleet:jobs'

// Sentinel runnerId used for the synthetic SceneResult written when a run's
// deadline passes with zero real reports — distinguishes "no runner ever
// reported" from an actual runner's keyId.
const INCOMPLETE_RUNNER_ID = 'timeout'

module.exports = {
  ROLES,
  STATUS,
  REDIS_CHANNEL,
  INCOMPLETE_RUNNER_ID
}