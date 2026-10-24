/**
 * Connection events.
 */
const collabService = require('../collaboration.service');
const logger = require('../../../common/utils/logger');

function registerConnectionEvents(socket, io) {
  // Setup presence on connect
  collabService.trackConnection(socket.id, socket.userId, socket.userName, socket.userAvatar);

  socket.on('disconnect', () => {
    const presence = collabService.getPresence(socket.id);
    if (presence) {
      const { projectId, activeFileId, userId } = presence;

      // Clean up document clients if they were editing
      if (activeFileId) {
        collabService.documentManager.removeClient(activeFileId, socket.id);
      }

      collabService.removeConnection(socket.id);

      // Check if user still has other connections in this project
      const remaining = projectId ? collabService.getUserConnectionsInProject(projectId, userId) : [];

      // Broadcast leave to project if they were in one
      if (projectId) {
        io.to(`project:${projectId}`).emit('presence:leave', {
          socketId: socket.id,
          userId,
          hasRemainingConnections: remaining.length > 0,
        });
      }

      logger.debug({ socketId: socket.id, userId }, 'Client disconnected');
    }
  });
}

module.exports = { registerConnectionEvents };
