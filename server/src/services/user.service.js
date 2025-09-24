const User = require('../models/user.model')
const { ConflictError, ValidationError, AppError } = require('../utils/appError')
const { STATUS, ROLE } = require('../utils/constants')

async function inviteUserEmail(email, role) {
  const existingUser = await User.findOne({ email: email })
  if (existingUser) throw new ConflictError('User with this email has already been invited')

  try {
    await User.create({
      email: email,
      role: role,
      status: STATUS.INVITED
    })
  } catch (err) {
    console.log(err)
    throw new AppError('Failed to create user', 500)
  }
}

async function listUsersPaginated(page, limit) {
  try {
    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 12

    const skip = (pageNum - 1) * limitNum

    const users = await User.find()
      .skip(skip)
      .limit(limitNum)
      .exec()

    const total = await User.countDocuments()

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limitNum),
      data: users
    }
  } catch (err) {
    console.log(err)
    throw new AppError('Failed to retrieve users', 500)
  }
}

async function editUserRoleById(userId, role) {
  try {
    const user = await User.findById(userId)
    user.role = role
    await user.save()
  } catch (err) {
    console.log(err)
    throw new AppError('Failed to update user role', 500)
  }
}

async function editUserStatusById(userId, status) {
  try {
    const user = await User.findById(userId)
    user.status = status
    await user.save()
  } catch (err) {
    console.log(err)
    throw new AppError('Failed to update user status', 500)
  }
}

async function deleteUserById(userId) {
  try {
    const result = await User.deleteOne({_id: userId})
  } catch (err) {
    console.log(err)
    throw new AppError('Failed to delete user', 500)
  }
}

module.exports = {
  inviteUserEmail,
  listUsersPaginated,
  editUserRoleById,
  editUserStatusById,
  deleteUserById
}