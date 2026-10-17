/**
 * Role-based authorization middleware.
 * Checks that the authenticated user has the required project role.
 * Must be used after authenticate middleware and on routes with :projectId param.
 */

const { prisma } = require('../config/database');
const AppError = require('../common/errors/AppError');
const ERROR_CODES = require('../common/errors/errorCodes');

/**
 * Require the user to be a member of the project with one of the specified roles.
 * @param {...string} allowedRoles - Roles that are permitted (e.g. 'OWNER', 'DEVELOPER')
 * @returns {Function} Express middleware
 */
function requireProjectRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;

      if (!projectId) {
        throw AppError.badRequest('Project ID is required');
      }

      const membership = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId, projectId },
        },
      });

      if (!membership) {
        throw AppError.forbidden(
          'You are not a member of this project',
          ERROR_CODES.PROJECT_ACCESS_DENIED
        );
      }

      if (!allowedRoles.includes(membership.role)) {
        throw AppError.forbidden(
          'You do not have the required role for this action',
          ERROR_CODES.INSUFFICIENT_PERMISSIONS
        );
      }

      // Attach membership info for downstream use
      req.membership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require the user to be any member of the project (any role).
 */
async function requireProjectMember(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    if (!projectId) {
      throw AppError.badRequest('Project ID is required');
    }

    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    if (!membership) {
      throw AppError.forbidden(
        'You are not a member of this project',
        ERROR_CODES.PROJECT_ACCESS_DENIED
      );
    }

    req.membership = membership;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireProjectRole, requireProjectMember };
