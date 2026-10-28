/**
 * Auth controller.
 * Thin HTTP handlers for auth operations.
 */

const authService = require('./auth.service');
const { sendSuccess } = require('../../common/utils/response');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPassword(req.body);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    // JWT is stateless — client discards token. This endpoint exists for
    // API completeness. Token blacklisting can be added if needed.
    return sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, getMe, resetPassword, logout };
