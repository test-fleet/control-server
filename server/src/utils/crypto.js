const crypto = require('crypto')

const MASTER_KEY = Buffer.from(process.env.MASTER_KEY, 'hex')

if (MASTER_KEY.length !== 32) {
  throw new Error('Master Key should be 32 bytes (64 hex chars)')
}

const ALG = 'aes-256-gcm'
const IV_LENGTH = 12

async function encryptSecret(plainTextSecret) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALG, MASTER_KEY, iv)

  const encrypted = Buffer.concat([
    cipher.update(plainTextSecret, 'utf-8'),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, encrypted, authTag]).toString('base64')
}

async function decryptSecret(encryptedSecret) {
  const data = Buffer.from(encryptedSecret, 'base64')

  const iv = data.subarray(0, IV_LENGTH) // first 12 bytes
  const encrypted = data.subarray(IV_LENGTH, data.length - 16) // bytes 12 - last 16
  const authTag = data.subarray(data.length - 16) // last 16 bytes

  const decipher = crypto.createDecipheriv(ALG, MASTER_KEY, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ])

  return decrypted.toString('utf-8')
}

function generateApiKey() {
  const bytes = crypto.randomBytes(12)
  const key = bytes.toString('base64url')
  return `rnr_${key}`
}

function generateApiSecret() {
  return crypto.randomBytes(32).toString('base64url')
}

module.exports = {
  encryptSecret,
  decryptSecret, 
  generateApiKey,
  generateApiSecret
}