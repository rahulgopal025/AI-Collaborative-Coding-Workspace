/**
 * Permission constants.
 * Maps project roles to the actions they are allowed to perform.
 */

const { PROJECT_ROLES } = require('../../common/constants/projectRoles');

/**
 * All possible actions in the system.
 */
const ACTIONS = {
  PROJECT_UPDATE: 'PROJECT_UPDATE',
  PROJECT_DELETE: 'PROJECT_DELETE',
  MEMBER_ADD: 'MEMBER_ADD',
  MEMBER_REMOVE: 'MEMBER_REMOVE',
  MEMBER_ROLE_CHANGE: 'MEMBER_ROLE_CHANGE',
  FILE_CREATE: 'FILE_CREATE',
  FILE_READ: 'FILE_READ',
  FILE_UPDATE: 'FILE_UPDATE',
  FILE_DELETE: 'FILE_DELETE',
  FOLDER_CREATE: 'FOLDER_CREATE',
  FOLDER_UPDATE: 'FOLDER_UPDATE',
  FOLDER_DELETE: 'FOLDER_DELETE',
  CHAT_SEND: 'CHAT_SEND',
  COLLABORATE: 'COLLABORATE',
};

/**
 * Role-to-permission mapping.
 * Each role lists the actions it can perform.
 */
const ROLE_PERMISSIONS = {
  [PROJECT_ROLES.OWNER]: Object.values(ACTIONS), // OWNER can do everything

  [PROJECT_ROLES.DEVELOPER]: [
    ACTIONS.FILE_CREATE,
    ACTIONS.FILE_READ,
    ACTIONS.FILE_UPDATE,
    ACTIONS.FILE_DELETE,
    ACTIONS.FOLDER_CREATE,
    ACTIONS.FOLDER_UPDATE,
    ACTIONS.FOLDER_DELETE,
    ACTIONS.CHAT_SEND,
    ACTIONS.COLLABORATE,
  ],

  [PROJECT_ROLES.VIEWER]: [
    ACTIONS.FILE_READ,
  ],
};

module.exports = { ACTIONS, ROLE_PERMISSIONS };
