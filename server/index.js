const express = require('express');

const { bootstrapAdminAccount } = require('./src/utils/bootstrapAdmin')
const { connectDatabase, disconnectDatabase } = require('./config/db')

async function startServer() {
  try {
    console.log('testdbstart')
    await connectDatabase()
    console.log('testdbend')

    console.log('testadminstart')
    await bootstrapAdminAccount()
    console.log('testadminend')

    const app = express()
    app.use(express.json())

    const port = process.env.PORT || 3000
    app.listen(port, () => {
      console.log(`server running on port ${port}`)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  console.log('shutting down gracefully...')
  await disconnectDatabase()
  process.exit(0)
})

startServer()