const User = require('../models/user')

async function bootstrapAdminAccount() {
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL

  if (!bootstrapEmail) {
    console.log('No bootstrap admin email configured')
    return
  }

  try {
    const existingBootstrapAccount = await User.findOne({ email: bootstrapEmail })
    
    if (!existingBootstrapAccount) {
      await User.create({
        email: bootstrapEmail,
        role: 'admin',
        status: 'invited'
      })
      console.log(`Bootstrap admin ${bootstrapEmail} invited. Please log in with your auth provider.`)
    } else {
      console.log(`Bootstrap admin ${bootstrapEmail} already exists`)
    }
  } catch (err) {
    console.error('Error creating bootstrap admin account', err)
    throw err
  }
}

module.exports = { bootstrapAdminAccount }