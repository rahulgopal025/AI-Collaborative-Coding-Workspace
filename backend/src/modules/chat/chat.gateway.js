/**
 * Chat Socket.IO gateway.
 * Handles real-time message events within project rooms.
 */

const chatService = require('./chat.service');
const logger = require('../../common/utils/logger');

/**
 * Register chat event handlers on a socket.
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
function registerChatEvents(socket, io) {
  socket.on('message:send', async (data) => {
    try {
      const { projectId, content } = data;
      const userId = socket.userId;

      if (!projectId || !content) return;

      const message = await chatService.sendMessage(projectId, userId, content);

      // Broadcast to the project room
      io.to(`project:${projectId}`).emit('message:new', message);
    } catch (error) {
      logger.error({ error: error.message }, 'Chat message:send error');
      socket.emit('error', { message: error.message });
    }
  });
}


module.exports = { registerChatEvents };

