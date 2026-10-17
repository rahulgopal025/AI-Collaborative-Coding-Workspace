/**
 * User business logic.
 */

const userRepository = require('./user.repository');
const AppError = require('../../common/errors/AppError');
const ERROR_CODES = require('../../common/errors/errorCodes');

async function getProfile(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }
  return user;
}

async function updateProfile(userId, data) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }
  return userRepository.updateUser(userId, data);
}

async function getUserById(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }
  return user;
}

module.exports = { getProfile, updateProfile, getUserById };
