/**
 * Room service.
 * Manages Socket.IO room logic for projects and files.
 */

const permissionService = require('../permissions/permission.service');
const logger = require('../../common/utils/logger');

/**
 * Authorize and join a project room.
 */
async function joinProjectRoom(socket, projectId, userId) {
  try {
    // Ensure user has access to the project
    await permissionService.can(userId, projectId, 'FILE_READ');

    const roomName = `project:${projectId}`;
    socket.join(roomName);
    logger.debug({ socketId: socket.id, projectId }, 'Joined project room');

    return true;
  } catch (error) {
    logger.warn({ error: error.message, userId, projectId }, 'Failed to join project room');
    return false;
  }
}

function leaveProjectRoom(socket, projectId) {
  socket.leave(`project:${projectId}`);
}

/**
 * Authorize and join a file/document room.
 */
async function joinFileRoom(socket, fileId, projectId, userId) {
  try {
    await permissionService.can(userId, projectId, 'FILE_READ');

    const roomName = `file:${fileId}`;
    socket.join(roomName);
    logger.debug({ socketId: socket.id, fileId }, 'Joined file room');

    return true;
  } catch (error) {
    logger.warn({ error: error.message, userId, fileId }, 'Failed to join file room');
    return false;
  }
}

function leaveFileRoom(socket, fileId) {
  socket.leave(`file:${fileId}`);
}

module.exports = {
  joinProjectRoom,
  leaveProjectRoom,
  joinFileRoom,
  leaveFileRoom,
};
