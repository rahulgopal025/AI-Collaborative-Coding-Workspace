/**
 * Document persistence.
 * Saves and loads Yjs document state to/from the File.yjsState column.
 */

const { prisma } = require('../../../config/database');
const yjsService = require('./yjs.service');
const logger = require('../../../common/utils/logger');

/**
 * Load Yjs state from database into a Y.Doc.
 * If no saved state exists, returns a fresh doc.
 * @param {string} fileId
 * @param {import('yjs').Doc} doc
 */
async function loadState(fileId, doc) {
  try {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: { yjsState: true, content: true },
    });

    if (!file) return;

    if (file.yjsState) {
      // Restore from binary Yjs state
      yjsService.applyUpdate(doc, new Uint8Array(file.yjsState));
    } else if (file.content) {
      // Initialize Y.Text from plain content (first-time collaborative open)
      const yText = doc.getText('content');
      if (yText.length === 0) {
        yText.insert(0, file.content);
      }
    }
  } catch (error) {
    logger.error({ error: error.message, fileId }, 'Failed to load Yjs state');
  }
}

/**
 * Persist Yjs document state to database.
 * Also snapshots plain-text content for REST API access.
 * @param {string} fileId
 * @param {import('yjs').Doc} doc
 */
async function saveState(fileId, doc) {
  try {
    const state = yjsService.encodeState(doc);
    const content = yjsService.getTextContent(doc);

    await prisma.file.update({
      where: { id: fileId },
      data: {
        yjsState: Buffer.from(state),
        content,
      },
    });

    try {
      const { syncFileByIdToDisk } = require('../../projectRunner/fileMaterializer');
      await syncFileByIdToDisk(fileId, content);
    } catch (diskErr) {
      logger.warn({ error: diskErr.message, fileId }, 'Failed to sync saved Yjs state to disk');
    }
  } catch (error) {
    logger.error({ error: error.message, fileId }, 'Failed to save Yjs state');
  }
}

module.exports = { loadState, saveState };
