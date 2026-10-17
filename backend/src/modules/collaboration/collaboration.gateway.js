/**
 * Collaboration Socket.IO Gateway.
 * Mounts socket connection authentication and initializes all event handlers.
 */

const { verifyToken } = require('../../common/utils/jwt');
const { prisma } = require('../../config/database');
const logger = require('../../common/utils/logger');

const { registerConnectionEvents } = require('./events/connection.events');
const { registerRoomEvents } = require('./events/room.events');
const { registerEditorEvents } = require('./events/editor.events');
const { registerPresenceEvents } = require('./events/presence.events');
const chatGateway = require('../chat/chat.gateway');
const collabService = require('./collaboration.service');

function setupCollaborationGateway(io) {
  // Socket.IO Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true },
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user.id;
      socket.userName = user.name;
      next();
    } catch (error) {
      logger.warn({ error: error.message }, 'Socket authentication failed');
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection Handler
  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id, userId: socket.userId }, 'Socket connected');

    registerConnectionEvents(socket, io);
    registerRoomEvents(socket, io);
    registerEditorEvents(socket, io);
    registerPresenceEvents(socket, io);
    chatGateway.registerChatEvents(socket, io);
  });

  // Graceful shutdown helper
  return {
    async close() {
      await collabService.documentManager.persistAll();
    }
  };
}

module.exports = { setupCollaborationGateway };
