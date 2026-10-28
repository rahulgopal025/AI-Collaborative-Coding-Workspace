/**
 * Editor events (Yjs updates).
 */
const collabService = require('../collaboration.service');
const logger = require('../../../common/utils/logger');

function registerEditorEvents(socket, io) {
  socket.on('editor:update', async ({ fileId, update }) => {
    try {
      if (!fileId || !update) return;
      await collabService.handleEditorUpdate(fileId, update, socket, io);
    } catch (error) {
      logger.error({ error: error.message, fileId }, 'Editor update failed');
    }
  });

  socket.on('editor:sync', async ({ fileId }) => {
    try {
      if (!fileId) return;
      await collabService.handleEditorSync(fileId, socket);
    } catch (error) {
      logger.error({ error: error.message, fileId }, 'Editor sync failed');
    }
  });

  socket.on('editor:save', async ({ fileId }) => {
    try {
      if (!fileId) return;
      await collabService.handleEditorSave(fileId, socket);
      socket.emit('editor:saved', { fileId, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error({ error: error.message, fileId }, 'Editor force save failed');
    }
  });
}

module.exports = { registerEditorEvents };
