/**
 * Presence events.
 * Handles custom presence updates (e.g., cursor position changes).
 */
const collabService = require('../collaboration.service');

function registerPresenceEvents(socket, io) {
  // Client explicitly updates its presence (e.g., cursor coords, selection)
  socket.on('presence:update', (updates) => {
    const presence = collabService.getPresence(socket.id);
    if (!presence || !presence.projectId) return;

    collabService.updatePresence(socket.id, updates);

    // Broadcast to the project
    io.to(`project:${presence.projectId}`).emit('presence:update', {
      socketId: socket.id,
      ...updates,
    });
  });
}

module.exports = { registerPresenceEvents };
