const path = require('path');
const express = require('express');
const fs = require('fs');

const { bootstrapAdminAccount } = require('./src/utils/bootstrapAdmin')
const { connectDatabase, disconnectDatabase } = require('./config/db')

async function startServer() {
  try {
    await connectDatabase()

    await bootstrapAdminAccount()

    const app = express()
    app.use(express.json())

    const FRONTEND_DIST = path.resolve(process.cwd(), 'frontend', 'dist');
    app.use(express.static(FRONTEND_DIST));

// Anything NOT starting with /api goes to React app
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });


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