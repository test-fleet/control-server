const { ConflictError, ValidationError, UnauthorizedError, AppError } = require('../utils/appError')
const userService = require('../services/user.service');

const { ROLES, STATUS } = require('../utils/constants')

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

//!
//! Must add some protection against a user deleting/editing their own account

async function inviteUser(req, res, next) {
  const userRole = req.user.role
  if (userRole !== ROLES.ADMIN) {
    return next(new UnauthorizedError('You must be an admin to invite users'))
  }

  const email = req.body.email.toLowerCase()
  const role = req.body.role.toLowerCase()


  if (role !== ROLES.ADMIN && role !== ROLES.USER) {
    return next(new ValidationError('Role must be admin or user'))
  }

  if (!emailRegex.test(email)) {
    return next(new ValidationError('Invalid email'))
  }

  const allowedDomainsString = process.env.ALLOWED_DOMAINS
  const allowedDomains = allowedDomainsString
    .split(',')
    .map(domain => domain.trim().toLowerCase())
    .filter(domain => domain.length > 0);

  const emailDomain = email.split('@')[1]?.toLowerCase()

  if (!allowedDomains.includes(emailDomain)) {
    return next(new UnauthorizedError('The email domain provided is not allowed'))
  }

  try {
    await userService.inviteUserEmail(email, role)
    res.status(201).json({
      message: `${email} has been invited`
    })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function listUsers(req, res, next) {
  try {
    const { page, limit } = req.query
    const result = await userService.listUsersPaginated(page, limit)

    res.status(200).json({
      success: true,
      ...result
    })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function editRole(req, res, next) {
  const userRole = req.user.role
  if (userRole !== ROLES.ADMIN) {
    return next(new UnauthorizedError('You must be an admin to edit users'))
  }

  const userId = req.params.id
  if (!userId) {
    return next(new ValidationError('userId must be provided'))
  }

  const updatedRole = req.body.role
  if (!updatedRole) {
    return next(new ValidationError('updated role must be provided'))
  }

  if (updatedRole !== ROLES.ADMIN && updatedRole !== ROLES.USER) {
    return next(new ValidationError('Role type must be admin or user'))
  }

  try {
    await userService.editUserRoleById(userId, updatedRole)

    res.status(200).json({
      message: 'user role has been updated'
    })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function editStatus(req, res, next) {
  const userRole = req.user.role
  if (userRole !== ROLES.ADMIN) {
    return next(new UnauthorizedError('You must be an admin to edit users'))
  }

  const userId = req.params.id
  if (!userId) {
    return next(new ValidationError('userId must be provided'))
  }

  const updatedStatus = req.body.status.toLowerCase()
  if (!updatedStatus) {
    return next(new ValidationError('updated status must be provided'))
  }

  if (updatedStatus !== STATUS.ACTIVE
    && updatedStatus != STATUS.INVITED
    && updatedStatus != STATUS.DISABLED) {
    return next(new ValidationError('Status must be: active, invited, or disabled'))
  }

  try {
    await userService.editUserStatusById(userId, updatedStatus)

    res.status(200).json({
      message: 'user status has been updated'
    })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

async function deleteUser(req, res, next) {
  const userId = req.params.id
  if (!userId) {
    return next(new ValidationError('userId must be provided'))
  }

  try {
    await userService.deleteUserById(userId)
    res.status(201).json({
      message: 'user deleted'
    })
  } catch (err) {
    console.log(err)
    return next(err)
  }
}

module.exports = {
  inviteUser,
  listUsers,
  editRole,
  editStatus,
  deleteUser
}