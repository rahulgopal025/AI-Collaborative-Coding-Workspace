/**
 * Auth business logic.
 * Handles registration, login, and current-user retrieval.
 */

const authRepository = require('./auth.repository');
const { hashPassword, comparePassword } = require('../../common/utils/password');
const { generateToken } = require('../../common/utils/jwt');
const AppError = require('../../common/errors/AppError');
const ERROR_CODES = require('../../common/errors/errorCodes');

async function register(data) {
  const existingUser = await authRepository.findByEmail(data.email);
  if (existingUser) {
    throw AppError.conflict('Email is already registered', ERROR_CODES.AUTH_EMAIL_EXISTS);
  }

  const hashedPassword = await hashPassword(data.password);
  const user = await authRepository.createUser({
    name: data.name,
    email: data.email,
    password: hashedPassword,
  });

  const token = generateToken({ id: user.id, email: user.email });

  return { user, token };
}

async function login(data) {
  const user = await authRepository.findByEmail(data.email);
  if (!user) {
    throw AppError.unauthorized('Invalid email or password', ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }

  const isValid = await comparePassword(data.password, user.password);
  if (!isValid) {
    throw AppError.unauthorized('Invalid email or password', ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }

  const token = generateToken({ id: user.id, email: user.email });
  const { password, ...safeUser } = user;

  return { user: safeUser, token };
}

async function getMe(userId) {
  const user = await authRepository.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }
  return user;
}

module.exports = { register, login, getMe };
