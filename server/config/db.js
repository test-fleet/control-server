const mongoose = require('mongoose')

async function connectDatabase(params) {
  try {
    const mongoUri = process.env.MONGODB_URI
    console.log(mongoUri)

    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is required')
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    console.log('Connected to MongoDB')

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection err', err)
    })

    mongoose.connection.on('disconnected', () => {
      console.error('MongoDB disconnected')
    })
  } catch (err) {
    console.error('Failed to connect to MongoDB', err)
    process.exit(1) //? graceful shutdown?
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