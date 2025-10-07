const Runner = require('../models/runner.model')
const { encryptSecret } = require('./crypto')

async function bootstrapDevRunner() {
  const masterKey = process.env.API_MASTER_KEY
  const masterSecret = process.env.API_MASTER_SECRET

  let runner = await Runner.findOne({ keyId: masterKey })
 
  try {
    if (!runner) {
      const encryptedSecret = await encryptSecret(masterSecret)
      await Runner.create({
        name: "dev-runner",
        createdBy: "server",
        keyId: masterKey,
        encryptedSecret: encryptedSecret
      })
    }
  } catch (err) {
    console.error("failed to bootstrap dev test runner.", err)
  }
}

module.exports = { bootstrapDevRunner }