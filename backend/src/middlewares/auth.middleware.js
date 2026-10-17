/**
 * Authentication middleware.
 * Extracts and verifies JWT from the Authorization header.
 * Attaches the authenticated user to req.user.
 */

const { verifyToken } = require('../common/utils/jwt');
const { prisma } = require('../config/database');
const AppError = require('../common/errors/AppError');
const ERROR_CODES = require('../common/errors/errorCodes');

/**
 * Require a valid JWT token on the request.
 * Expects: Authorization: Bearer <token>
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('No token provided', ERROR_CODES.AUTH_NO_TOKEN);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Fetch user from database to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    if (!user) {
      throw AppError.unauthorized('User no longer exists', ERROR_CODES.AUTH_TOKEN_INVALID);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate };
