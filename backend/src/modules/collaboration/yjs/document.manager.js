/**
 * Document manager.
 * In-memory registry of active Yjs documents keyed by fileId.
 * Handles create/get/destroy lifecycle and debounced persistence.
 */

const yjsService = require('./yjs.service');
const documentPersistence = require('./document.persistence');
const logger = require('../../../common/utils/logger');

// Map<fileId, { doc: Y.Doc, clients: Set<socketId>, saveTimer: NodeJS.Timeout | null }>
const activeDocuments = new Map();

const SAVE_DEBOUNCE_MS = 2000; // Persist 2s after last update

/**
 * Get or create an active document for a file.
 * Loads persisted state on first access.
 * @param {string} fileId
 * @returns {Promise<import('yjs').Doc>}
 */
async function getOrCreateDoc(fileId) {
  if (activeDocuments.has(fileId)) {
    return activeDocuments.get(fileId).doc;
  }

  const doc = yjsService.createDoc();
  await documentPersistence.loadState(fileId, doc);

  activeDocuments.set(fileId, {
    doc,
    clients: new Set(),
    saveTimer: null,
  });

  logger.debug({ fileId }, 'Document loaded into memory');
  return doc;
}

/**
 * Add a client (socket) to a document's active client set.
 */
function addClient(fileId, socketId) {
  const entry = activeDocuments.get(fileId);
  if (entry) {
    entry.clients.add(socketId);
  }
}

/**
 * Remove a client from a document. If no clients remain, persist and clean up.
 */
async function removeClient(fileId, socketId) {
  const entry = activeDocuments.get(fileId);
  if (!entry) return;

  entry.clients.delete(socketId);

  if (entry.clients.size === 0) {
    // No more active editors — persist and remove from memory
    if (entry.saveTimer) clearTimeout(entry.saveTimer);
    await documentPersistence.saveState(fileId, entry.doc);
    entry.doc.destroy();
    activeDocuments.delete(fileId);
    logger.debug({ fileId }, 'Document removed from memory (no active clients)');
  }
}

/**
 * Schedule a debounced save after a document update.
 */
function scheduleSave(fileId) {
  const entry = activeDocuments.get(fileId);
  if (!entry) return;

  if (entry.saveTimer) clearTimeout(entry.saveTimer);

  entry.saveTimer = setTimeout(async () => {
    await documentPersistence.saveState(fileId, entry.doc);
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Get the current client count for a document.
 */
function getClientCount(fileId) {
  const entry = activeDocuments.get(fileId);
  return entry ? entry.clients.size : 0;
}

/**
 * Persist all active documents. Call during graceful shutdown.
 */
async function persistAll() {
  for (const [fileId, entry] of activeDocuments) {
    if (entry.saveTimer) clearTimeout(entry.saveTimer);
    await documentPersistence.saveState(fileId, entry.doc);
    entry.doc.destroy();
  }
  activeDocuments.clear();
  logger.info('All active documents persisted');
}

module.exports = {
  getOrCreateDoc,
  addClient,
  removeClient,
  scheduleSave,
  getClientCount,
  persistAll,
};
