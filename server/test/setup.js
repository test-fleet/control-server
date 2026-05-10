// Set required environment variables before any module loads
process.env.MASTER_KEY = 'a'.repeat(64) // 32 bytes as 64 hex chars
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.REDIS_CHANNEL = 'testfleet:jobs'
process.env.ENV = 'test'
