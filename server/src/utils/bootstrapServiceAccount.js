const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const { STATUS, ROLES } = require('./constants')

const SERVICE_ACCOUNT_EMAIL = 'service-account@internal.testfleet'

async function bootstrapServiceAccount() {
  let serviceUser = await User.findOne({ email: SERVICE_ACCOUNT_EMAIL })

  if (!serviceUser) {
    serviceUser = await User.create({
      email: SERVICE_ACCOUNT_EMAIL,
      userName: 'Service Account',
      role: ROLES.ADMIN,
      status: STATUS.ACTIVE,
    })
    console.log('[bootstrap] Service account created')
  }

  // noTimestamp removes the `iat` claim so the token is deterministic:
  // same user _id + same JWT_SECRET → same token across restarts.
  // No expiry — revoke by rotating JWT_SECRET or disabling the user in the DB.
  const token = jwt.sign(
    { id: serviceUser._id.toString() },
    process.env.JWT_SECRET,
    { noTimestamp: true }
  )

  console.log('\n========== STATIC ADMIN JWT ==========')
  console.log(token)
  console.log('======================================\n')

  return token
}

module.exports = { bootstrapServiceAccount }
