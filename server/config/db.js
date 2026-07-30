const mongoose = require('mongoose')

const RETRY_DELAY_MS = 5000

// Unlike the redis client, mongoose's own connect() doesn't retry a failed
// initial attempt on its own — it rejects once and stops. This is a thin
// retry loop around it so a Mongo outage at boot doesn't take the whole
// process down: it just keeps trying, and /ready (server/index.js) reports
// the real state to the frontend's SystemGate in the meantime. Once
// connected, the MongoDB driver handles reconnection on its own for any
// later drop — the 'error'/'disconnected' listeners below just log those,
// they don't need to trigger another round of this loop.
async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error('MONGO_URI environment variable is required')
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection err', err)
  })

  mongoose.connection.on('disconnected', () => {
    console.error('MongoDB disconnected')
  })

  for (;;) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })
      console.log('Connected to MongoDB')
      return
    } catch (err) {
      console.error(`Failed to connect to MongoDB, retrying in ${RETRY_DELAY_MS / 1000}s:`, err.message)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
}

async function disconnectDatabase() {
  try {
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  } catch (err) {
    console.error('Error disconnecting from MongoDB', err)
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase
}