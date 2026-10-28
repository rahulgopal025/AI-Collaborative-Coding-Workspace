/**
 * Collaboration service facade.
 * Aggregates presence, rooms, and document management.
 */

const presenceService = require('./presence.service');
const roomService = require('./room.service');
const documentManager = require('./yjs/document.manager');
const yjsService = require('./yjs/yjs.service');
const permissionService = require('../permissions/permission.service');
const { prisma } = require('../../config/database');
const logger = require('../../common/utils/logger');

// Cache fileId -> projectId mapping
const fileProjectMap = new Map();

async function getFileProjectId(fileId) {
  if (fileProjectMap.has(fileId)) {
    return fileProjectMap.get(fileId);
  }
  try {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: { projectId: true },
    });
    if (file?.projectId) {
      fileProjectMap.set(fileId, file.projectId);
      return file.projectId;
    }
  } catch (err) {
    logger.warn({ fileId, error: err.message }, 'Failed to look up projectId for file');
  }
  return null;
}

async function handleEditorUpdate(fileId, updateData, socket, io) {
  const projectId = await getFileProjectId(fileId);
  if (projectId) {
    try {
      await permissionService.can(socket.userId, projectId, 'FILE_UPDATE');
    } catch (err) {
      logger.warn({ userId: socket.userId, fileId, projectId }, 'Unauthorized editor update rejected for viewer');
      socket.emit('editor:error', { fileId, message: 'Viewer access: read-only mode' });
      return;
    }
  }

  const doc = await documentManager.getOrCreateDoc(fileId);

  // Apply update to server document
  const updateArray = new Uint8Array(updateData);
  yjsService.applyUpdate(doc, updateArray);

  // Schedule a debounced save to the database
  documentManager.scheduleSave(fileId);

  // Broadcast update to others in the file room
  socket.to(`file:${fileId}`).emit('editor:update', {
    fileId,
    update: updateData,
  });
}

async function handleEditorSync(fileId, socket) {
  const doc = await documentManager.getOrCreateDoc(fileId);

  // Send the current full state vector to the connecting client
  const state = yjsService.encodeState(doc);
  socket.emit('editor:sync', {
    fileId,
    state: Array.from(state), // convert Uint8Array to Array for JSON transport
  });
}

async function handleEditorSave(fileId, socket) {
  if (socket?.userId) {
    const projectId = await getFileProjectId(fileId);
    if (projectId) {
      try {
        await permissionService.can(socket.userId, projectId, 'FILE_UPDATE');
      } catch (err) {
        logger.warn({ userId: socket.userId, fileId, projectId }, 'Unauthorized editor save rejected for viewer');
        socket.emit('editor:error', { fileId, message: 'Viewer access: read-only mode' });
        return;
      }
    }
  }
  await documentManager.forceSave(fileId);
}

module.exports = {
  ...presenceService,
  ...roomService,
  documentManager,
  handleEditorUpdate,
  handleEditorSync,
  handleEditorSave,
};
