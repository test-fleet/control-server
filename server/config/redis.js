const { createClient } = require('redis')

let publisher = null

async function connectRedis() {
  publisher = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' })

  publisher.on('error', err => console.error('[redis] error:', err))

  await publisher.connect()
  console.log('[redis] publisher connected')
  return publisher
}

function getPublisher() {
  if (!publisher || !publisher.isOpen) {
    throw new Error('Redis publisher not connected')
  }
  return publisher
}

async function disconnectRedis() {
  if (publisher) {
    await publisher.disconnect()
    publisher = null
  }
}

module.exports = { connectRedis, getPublisher, disconnectRedis }
