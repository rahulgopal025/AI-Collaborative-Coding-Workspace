/**
 * Socket.IO instance registry.
 * Allows services to access Socket.IO instances and namespaces for broadcasting.
 */

let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  return ioInstance;
}

module.exports = { setIO, getIO };
