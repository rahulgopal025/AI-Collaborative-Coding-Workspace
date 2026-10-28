/**
 * Auth business logic.
 * Handles registration, login, and current-user retrieval.
 */

const authRepository = require('./auth.repository');
const { hashPassword, verifyPasswordAndCheckUpgrade } = require('../../common/utils/password');
const { generateToken } = require('../../common/utils/jwt');
const AppError = require('../../common/errors/AppError');
const ERROR_CODES = require('../../common/errors/errorCodes');
const logger = require('../../common/utils/logger');

async function register(data) {
  const normalizedEmail = (data.email || '').trim().toLowerCase();
  const existingUser = await authRepository.findByEmail(normalizedEmail);
  if (existingUser) {
    throw AppError.conflict('Email is already registered', ERROR_CODES.AUTH_EMAIL_EXISTS);
  }

  const hashedPassword = await hashPassword(data.password);
  const user = await authRepository.createUser({
    name: (data.name || '').trim(),
    email: normalizedEmail,
    password: hashedPassword,
  });

  const token = generateToken({ id: user.id, email: user.email });

  return { user, token };
}

async function login(data) {
  const rawEmail = typeof data.email === 'string' ? data.email : '';
  const normalizedEmail = rawEmail.trim().toLowerCase();

  const user = await authRepository.findByEmail(normalizedEmail || rawEmail);
  if (!user) {
    throw AppError.unauthorized('Invalid email or password', ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }

  const { isValid, needsUpgrade, reason } = await verifyPasswordAndCheckUpgrade(data.password, user.password);
  if (!isValid) {
    throw AppError.unauthorized('Invalid email or password', ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }

  // Transparently upgrade legacy or lower-cost hash to standard 12-round bcrypt
  if (needsUpgrade) {
    try {
      const trimmedPwd = typeof data.password === 'string' ? data.password.trim() : data.password;
      const upgradedHash = await hashPassword(trimmedPwd);
      await authRepository.updatePassword(user.id, upgradedHash);
      logger.info({ userId: user.id, reason }, 'User password hash upgraded to current standard');
    } catch (err) {
      logger.error({ userId: user.id, error: err.message }, 'Failed to upgrade password hash during login');
    }
  }

  // Normalize legacy email in DB if it was stored with different case/spacing
  if (user.email !== normalizedEmail && normalizedEmail.length > 0) {
    try {
      await authRepository.updateEmail(user.id, normalizedEmail);
      user.email = normalizedEmail;
      logger.info({ userId: user.id }, 'User email normalized to lowercase in database');
    } catch (err) {
      logger.warn({ userId: user.id, error: err.message }, 'Could not update email casing in database');
    }
  }

  const token = generateToken({ id: user.id, email: user.email });
  const { password, ...safeUser } = user;

  return { user: safeUser, token };
}

async function resetPassword(data) {
  const rawEmail = typeof data.email === 'string' ? data.email : '';
  const normalizedEmail = rawEmail.trim().toLowerCase();

  const user = await authRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw AppError.notFound('Account not found', ERROR_CODES.USER_NOT_FOUND);
  }

  const trimmedNewPassword = typeof data.newPassword === 'string' ? data.newPassword.trim() : '';
  if (!trimmedNewPassword || trimmedNewPassword.length < 6) {
    throw AppError.badRequest('Password must be at least 6 characters', ERROR_CODES.VALIDATION_ERROR);
  }

  const hashedPassword = await hashPassword(trimmedNewPassword);
  await authRepository.updatePassword(user.id, hashedPassword);

  // Also ensure email is normalized
  if (user.email !== normalizedEmail && normalizedEmail.length > 0) {
    await authRepository.updateEmail(user.id, normalizedEmail);
  }

  return { message: 'Password has been reset successfully. You can now sign in with your new password.' };
}

async function getMe(userId) {
  const user = await authRepository.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
  }
  return user;
}

module.exports = { register, login, resetPassword, getMe };
