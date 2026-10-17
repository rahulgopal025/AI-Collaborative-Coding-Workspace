/**
 * Project-level role constants.
 * Defines what roles a user can have within a project.
 */

const PROJECT_ROLES = {
  OWNER: 'OWNER',
  DEVELOPER: 'DEVELOPER',
  VIEWER: 'VIEWER',
};

// Ordered from highest to lowest privilege for comparison
const ROLE_HIERARCHY = [
  PROJECT_ROLES.OWNER,
  PROJECT_ROLES.DEVELOPER,
  PROJECT_ROLES.VIEWER,
];

module.exports = { PROJECT_ROLES, ROLE_HIERARCHY };
