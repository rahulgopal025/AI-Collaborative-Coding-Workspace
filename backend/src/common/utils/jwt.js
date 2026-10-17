/**
 * JWT utility functions.
 * Wraps jsonwebtoken to provide simple generate/verify operations.
 */

const jwt = require('jsonwebtoken');
const AppError = require('../errors/AppError');
const ERROR_CODES = require('../errors/errorCodes');

/**
 * Generate a JWT token for a user.
 * @param {{ id: string, email: string }} payload - Data to encode in the token
 * @returns {string} Signed JWT token
 */
function generateToken(payload) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    { id: payload.id, email: payload.email },
    secret,
    { expiresIn }
  );
}

/**
 * Verify and decode a JWT token.
 * @param {string} token - JWT token string
 * @returns {{ id: string, email: string }} Decoded payload
 * @throws {AppError} If the token is invalid or expired
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Token has expired', ERROR_CODES.AUTH_TOKEN_EXPIRED);
    }
    throw AppError.unauthorized('Invalid token', ERROR_CODES.AUTH_TOKEN_INVALID);
  }
}

module.exports = { generateToken, verifyToken };
