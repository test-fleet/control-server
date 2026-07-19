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

module.exports = {
  ROLES,
  STATUS,
  REDIS_CHANNEL
}