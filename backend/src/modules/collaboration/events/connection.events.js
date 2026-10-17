/**
 * Connection events.
 */
const collabService = require('../collaboration.service');
const logger = require('../../../common/utils/logger');

function registerConnectionEvents(socket, io) {
  // Setup presence on connect
  collabService.trackConnection(socket.id, socket.userId, socket.userName);

  socket.on('disconnect', () => {
    const presence = collabService.getPresence(socket.id);
    if (presence) {
      const { projectId, activeFileId } = presence;

      // Clean up document clients if they were editing
      if (activeFileId) {
        collabService.documentManager.removeClient(activeFileId, socket.id);
      }

      // Broadcast leave to project if they were in one
      if (projectId) {
        io.to(`project:${projectId}`).emit('presence:leave', { socketId: socket.id });
      }

      collabService.removeConnection(socket.id);
      logger.debug({ socketId: socket.id }, 'Client disconnected');
    }
  });
}

module.exports = { registerConnectionEvents };
