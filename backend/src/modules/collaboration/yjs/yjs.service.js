/**
 * Yjs service.
 * Manages Y.Doc instances — create, apply updates, encode state.
 */

const Y = require('yjs');

/**
 * Create a new Yjs document.
 * @returns {Y.Doc}
 */
function createDoc() {
  return new Y.Doc();
}

/**
 * Apply a binary update to a Yjs document.
 * @param {Y.Doc} doc
 * @param {Uint8Array} update
 */
function applyUpdate(doc, update) {
  Y.applyUpdate(doc, update);
}

/**
 * Encode the full state of a Yjs document as a binary snapshot.
 * @param {Y.Doc} doc
 * @returns {Uint8Array}
 */
function encodeState(doc) {
  return Y.encodeStateAsUpdate(doc);
}

/**
 * Encode the state vector (used for sync protocol).
 * @param {Y.Doc} doc
 * @returns {Uint8Array}
 */
function encodeStateVector(doc) {
  return Y.encodeStateVector(doc);
}

/**
 * Encode state as update from a state vector (for incremental sync).
 * @param {Y.Doc} doc
 * @param {Uint8Array} stateVector
 * @returns {Uint8Array}
 */
function encodeStateAsUpdate(doc, stateVector) {
  return Y.encodeStateAsUpdate(doc, stateVector);
}

/**
 * Get the text content from a Y.Doc's default text type.
 * @param {Y.Doc} doc
 * @returns {string}
 */
function getTextContent(doc) {
  return doc.getText('content').toString();
}

module.exports = {
  createDoc,
  applyUpdate,
  encodeState,
  encodeStateVector,
  encodeStateAsUpdate,
  getTextContent,
};


