/**
 * Collaboration service facade.
 * Aggregates presence, rooms, and document management.
 */

const presenceService = require('./presence.service');
const roomService = require('./room.service');
const documentManager = require('./yjs/document.manager');
const yjsService = require('./yjs/yjs.service');

async function handleEditorUpdate(fileId, updateData, socket, io) {
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

module.exports = {
  ...presenceService,
  ...roomService,
  documentManager,
  handleEditorUpdate,
  handleEditorSync,
};
