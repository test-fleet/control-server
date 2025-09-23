const User = require('../models/user.model')
const { NotFoundError } = require('../utils/appError')

async function findOrCreateOAuthUser(userInfo) {
  const email = userInfo.email.toLowerCase()
  const userName = userInfo.name
  const avatar = userInfo.avatar
  if (!email) throw new NotFoundError('No email returned by OAuth provider')

  let user = await User.findOne({ email })

  if (!user) {
    throw new UnauthorizedError('User not invited')
  }

  if (user.status === 'disabled') {
    throw new UnauthorizedError('Account is disabled')
  }

  if (user.status === 'invited') {
    user.status = 'active'
    user.userName = userName
    user.avatar = avatar
    user.lastLogin = new Date()
  } else {
    user.userName = userName
    user.avatar = avatar
    user.lastLogin = new Date()
  }

  await user.save()
  
  return user
}

module.exports = { findOrCreateOAuthUser }
