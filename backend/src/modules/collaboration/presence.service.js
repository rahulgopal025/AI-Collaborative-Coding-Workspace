/**
 * Presence service.
 * Tracks connected users, their project rooms, and active files.
 */

// Map<socketId, { userId, name, projectId, activeFileId, connectedAt }>
const activeConnections = new Map();

function trackConnection(socketId, userId, name, avatarUrl = null) {
  activeConnections.set(socketId, {
    userId,
    name: name || 'User',
    avatarUrl: avatarUrl || null,
    projectId: null,
    activeFileId: null,
    connectedAt: new Date(),
  });
}

function removeConnection(socketId) {
  activeConnections.delete(socketId);
}

function updatePresence(socketId, updates) {
  const presence = activeConnections.get(socketId);
  if (presence) {
    Object.assign(presence, updates);
  }
}

function getPresence(socketId) {
  return activeConnections.get(socketId);
}

function getProjectPresence(projectId) {
  const users = [];
  for (const [socketId, data] of activeConnections.entries()) {
    if (data.projectId === projectId) {
      users.push({ socketId, ...data });
    }
  }
  return users;
}

function getUserConnectionsInProject(projectId, userId) {
  const sockets = [];
  for (const [socketId, data] of activeConnections.entries()) {
    if (data.projectId === projectId && data.userId === userId) {
      sockets.push(socketId);
    }
  }
  return sockets;
}

module.exports = {
  trackConnection,
  removeConnection,
  updatePresence,
  getPresence,
  getProjectPresence,
  getUserConnectionsInProject,
};
