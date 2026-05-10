const Runner = require('../models/runner.model')
const { encryptSecret } = require('./crypto')

async function bootstrapDevRunner() {
  const runners = [
    { name: 'dev-runner-a', keyId: process.env.API_KEY_A, secret: process.env.API_SECRET_A },
    { name: 'dev-runner-b', keyId: process.env.API_KEY_B, secret: process.env.API_SECRET_B },
  ]

  for (const { name, keyId, secret } of runners) {
    if (!keyId || !secret) {
      console.warn(`[bootstrap] skipping runner "${name}": missing keyId or secret env var`)
      continue
    }
    try {
      const existing = await Runner.findOne({ keyId })
      if (!existing) {
        const encryptedSecret = await encryptSecret(secret)
        await Runner.create({ name, createdBy: 'server', keyId, encryptedSecret })
        console.log(`[bootstrap] registered runner "${name}"`)
      }
    } catch (err) {
      console.error(`[bootstrap] failed to register runner "${name}":`, err)
    }
  }
}

module.exports = { bootstrapDevRunner }