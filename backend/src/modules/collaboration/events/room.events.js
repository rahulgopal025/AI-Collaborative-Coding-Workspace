/**
 * Room events (Project and File).
 */
const collabService = require('../collaboration.service');

function registerRoomEvents(socket, io) {
  socket.on('project:join', async ({ projectId }) => {
    const success = await collabService.joinProjectRoom(socket, projectId, socket.userId);
    if (success) {
      collabService.updatePresence(socket.id, { projectId });

      // Notify others in project
      const presence = collabService.getPresence(socket.id);
      socket.to(`project:${projectId}`).emit('presence:join', presence);

      // Send current project presence to the newly joined user
      const projectUsers = collabService.getProjectPresence(projectId);
      socket.emit('presence:list', projectUsers);
    }
  });

  socket.on('project:leave', ({ projectId }) => {
    const presence = collabService.getPresence(socket.id);
    collabService.leaveProjectRoom(socket, projectId);
    collabService.updatePresence(socket.id, { projectId: null, activeFileId: null });
    socket.to(`project:${projectId}`).emit('presence:leave', { socketId: socket.id, userId: presence?.userId });
  });

  socket.on('file:join', async ({ fileId, projectId }) => {
    const success = await collabService.joinFileRoom(socket, fileId, projectId, socket.userId);
    if (success) {
      collabService.updatePresence(socket.id, { activeFileId: fileId });
      collabService.documentManager.addClient(fileId, socket.id);

      // Tell project room that this user is now on this file
      io.to(`project:${projectId}`).emit('presence:update', {
        socketId: socket.id,
        activeFileId: fileId,
      });

      // Send full state to sync the new joiner
      await collabService.handleEditorSync(fileId, socket);
    }
  });

  socket.on('file:leave', ({ fileId, projectId }) => {
    collabService.leaveFileRoom(socket, fileId);
    collabService.updatePresence(socket.id, { activeFileId: null });
    collabService.documentManager.removeClient(fileId, socket.id);

    io.to(`project:${projectId}`).emit('presence:update', {
      socketId: socket.id,
      activeFileId: null,
    });
  });
}

module.exports = { registerRoomEvents };
