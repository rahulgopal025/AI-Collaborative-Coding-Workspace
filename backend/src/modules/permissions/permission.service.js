/**
 * Permission service.
 * Centralized authorization — checks if a user can perform an action on a project.
 */

const permissionRepository = require('./permission.repository');
const { ROLE_PERMISSIONS } = require('./permission.constants');
const AppError = require('../../common/errors/AppError');
const ERROR_CODES = require('../../common/errors/errorCodes');

/**
 * Check if a user has permission to perform an action on a project.
 * Throws 403 if the user lacks permission.
 *
 * @param {string} userId
 * @param {string} projectId
 * @param {string} action - One of the ACTIONS constants
 */
async function can(userId, projectId, action) {
  const membership = await permissionRepository.getMembership(userId, projectId);

  if (!membership) {
    throw AppError.forbidden(
      'You are not a member of this project',
      ERROR_CODES.PROJECT_ACCESS_DENIED
    );
  }

  const allowedActions = ROLE_PERMISSIONS[membership.role] || [];

  if (!allowedActions.includes(action)) {
    throw AppError.forbidden(
      'You do not have permission to perform this action',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }
}

module.exports = { can };
