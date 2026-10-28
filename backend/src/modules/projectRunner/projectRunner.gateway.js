/**
 * Project Runner Socket.IO Gateway.
 * Mounts the `/project-runner` namespace for streaming terminal I/O
 * between the frontend and Docker containers.
 *
 * Events:
 *   Client → Server:
 *     - runner:start-container { projectId }   — Create & start a project container
 *     - runner:exec-command   { command, projectId? } — Execute a command in the container
 *     - runner:run-project    { projectId }     — Auto-install and start dev server
 *     - runner:kill-process   { projectId? }    — Abort the current exec
 *     - runner:destroy-container { projectId? } — Stop & remove the container
 *     - runner:check-docker                     — Check Docker availability
 *     - terminal:init { projectId, sessionId, cols, rows } — Start interactive PTY
 *     - terminal:data { sessionId, data }       — Send stdin to PTY
 *     - terminal:resize { sessionId, cols, rows } — Resize PTY window
 *     - terminal:kill { sessionId }             — Terminate PTY session
 *
 *   Server → Client:
 *     - runner:docker-status   { available, version?, error? }
 *     - runner:container-ready { containerId, port, previewPorts }
 *     - runner:output          { type, content }
 *     - runner:exec-started    { command }
 *     - runner:exec-finished   { exitCode }
 *     - runner:app-ready       { url, port }
 *     - runner:error           { message, code }
 *     - runner:files-synced    { projectId, files }
 *     - runner:container-destroyed
 *     - terminal:ready         { sessionId }
 *     - terminal:data          { sessionId, data }
 *     - terminal:exit          { sessionId, code }
 *     - runner:node-modules-status { projectId, hasNodeModules }
 */

const { verifyToken } = require('../../common/utils/jwt');
const { prisma } = require('../../config/database');
const logger = require('../../common/utils/logger');
const permissionService = require('../permissions/permission.service');
const codeServerService = require('./codeServer.service');
const { validateCommand } = require('./projectRunner.validator');
const fileMaterializer = require('./fileMaterializer');
const fs = require('fs');
const path = require('path');

/**
 * Active exec abort functions, keyed by projectId.
 */
const activeProjectExecs = new Map();

/**
 * Active interactive PTY terminal sessions, keyed by `${socketId}:${sessionId}`.
 */
const activeTerminalSessions = new Map();
let runnerNamespace = null;

/**
 * Set up the /project-runner Socket.IO namespace.
 *
 * @param {import('socket.io').Server} io
 * @returns {{ close: () => Promise<void> }}
 */
function setupProjectRunnerGateway(io) {
  const namespace = io.of('/project-runner');
  runnerNamespace = namespace;

  // ─── Authentication Middleware ─────────────────────────
  namespace.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1] ||
        socket.handshake.query?.token;

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

      const handshakeProjectId =
        socket.handshake.query?.projectId ||
        socket.handshake.auth?.projectId;

      if (handshakeProjectId && /^[a-f0-9-]{36}$/i.test(handshakeProjectId)) {
        await permissionService.can(user.id, handshakeProjectId, 'COLLABORATE');
        socket.projectId = handshakeProjectId;
      }

      next();
    } catch (error) {
      logger.warn({ error: error.message }, 'Project runner socket auth failed');
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // ─── Connection Handler ────────────────────────────────
  namespace.on('connection', (socket) => {
    logger.debug(
      { socketId: socket.id, userId: socket.userId, projectId: socket.projectId },
      'Project runner socket connected'
    );

    if (socket.projectId) {
      socket.join(`project:${socket.projectId}`);
    }

    // ─── Check Docker availability ─────────────────────
    socket.on('runner:check-docker', async () => {
      try {
        const status = await codeServerService.checkStatus();
        socket.emit('runner:docker-status', status);
      } catch (err) {
        socket.emit('runner:docker-status', { available: false, error: err.message });
      }
    });

    // ─── Start / Join Container ────────────────────────
    socket.on('runner:start-container', async ({ projectId } = {}) => {
      try {
        if (!projectId) {
          return emitError(socket, 'Project ID is required', 'RUNNER_MISSING_PROJECT');
        }

        // Authorization: check project membership
        await permissionService.can(socket.userId, projectId, 'COLLABORATE');

        socket.projectId = projectId;
        socket.join(`project:${projectId}`);

        // Materialize project files to disk if not already materialized
        const projectDir = fileMaterializer.getProjectDir(projectId);
        let fileCount = 0;

        if (!fs.existsSync(projectDir)) {
          socket.emit('runner:output', {
            type: 'system',
            content: '[Materializing project files from database...]',
          });
          const result = await fileMaterializer.materialize(projectId);
          fileCount = result.fileCount;
          socket.emit('runner:output', {
            type: 'system',
            content: `[Materialized ${fileCount} files to workspace]`,
          });
        }

        // Start filesystem watcher
        fileMaterializer.startWatcher(projectId, io);

        // Start or join container
        socket.emit('runner:output', {
          type: 'system',
          content: '[Starting Docker project container...]',
        });

        const result = await codeServerService.startContainer(
          projectId,
          projectDir,
          socket.id
        );

        socket.emit('runner:container-ready', {
          containerId: result.containerId,
          port: result.port,
          previewPorts: result.previewPorts,
          isNew: result.isNew,
        });

        socket.emit('runner:output', {
          type: 'system',
          content: `[Container ready ✓ — Node environment active]`,
        });

        logger.info(
          { socketId: socket.id, userId: socket.userId, projectId, containerId: result.containerId },
          'User joined project runner container'
        );
      } catch (err) {
        logger.error({ error: err.message, socketId: socket.id }, 'Failed to start container');
        emitError(socket, err.message, err.code || 'RUNNER_START_FAILED');
      }
    });

    // ─── Execute Shell Command ─────────────────────────
    socket.on('runner:exec-command', async ({ command, projectId }) => {
      const targetProjectId = projectId || socket.projectId;
      if (!targetProjectId) {
        return emitError(socket, 'No project container associated with this session', 'RUNNER_NO_PROJECT');
      }

      try {
        await permissionService.can(socket.userId, targetProjectId, 'COLLABORATE');

        // Validate command against allowlist
        const { sanitized, description } = validateCommand(command);

        const session = codeServerService.getSession(targetProjectId);
        if (!session) {
          return emitError(socket, 'No active container for this project. Start one first.', 'RUNNER_NO_SESSION');
        }

        // Broadcast command start to all teammates in this project
        namespace.to(`project:${targetProjectId}`).emit('runner:exec-started', { command: sanitized });
        namespace.to(`project:${targetProjectId}`).emit('runner:output', {
          type: 'system',
          content: `$ ${sanitized}`,
        });

        logger.info(
          { projectId: targetProjectId, command: sanitized, description },
          'Executing command in project container'
        );

        const { abort } = await codeServerService.executeCommand(
          targetProjectId,
          sanitized,
          // onOutput callback
          (type, data) => {
            namespace.to(`project:${targetProjectId}`).emit('runner:output', {
              type: type === 'stderr' ? 'error' : 'output',
              content: data,
            });

            // Detect if a dev server started and announce preview URL
            if (
              data.includes('Local:') ||
              data.includes('localhost:') ||
              data.includes('http://')
            ) {
              const portMatch = data.match(/localhost:(\d+)/i) || data.match(/http:\/\/[^:]+:(\d+)/i);
              const detectedPort = portMatch ? parseInt(portMatch[1], 10) : 5173;

              namespace.to(`project:${targetProjectId}`).emit('runner:app-ready', {
                port: detectedPort,
                url: `/api/project-runner/${targetProjectId}/preview/`,
                projectId: targetProjectId,
              });
            }
          },
          // onExit callback
          (exitCode) => {
            activeProjectExecs.delete(targetProjectId);

            namespace.to(`project:${targetProjectId}`).emit('runner:output', {
              type: 'system',
              content: `\n[Process finished with exit code ${exitCode}]`,
            });

            namespace.to(`project:${targetProjectId}`).emit('runner:exec-finished', { exitCode });
          }
        );

        // Store abort function
        activeProjectExecs.set(targetProjectId, abort);
      } catch (err) {
        logger.warn({ error: err.message, projectId: targetProjectId }, 'Command execution failed');
        emitError(socket, err.message, err.code || 'RUNNER_EXEC_FAILED');
      }
    });

    // ─── Run Project (Auto install & dev server) ───────
    socket.on('runner:run-project', async ({ projectId }) => {
      const targetProjectId = projectId || socket.projectId;
      if (!targetProjectId) {
        return emitError(socket, 'Project ID is required', 'RUNNER_MISSING_PROJECT');
      }

      try {
        await permissionService.can(socket.userId, targetProjectId, 'COLLABORATE');

        const projectDir = fileMaterializer.getProjectDir(targetProjectId);
        const pkgJsonPath = path.join(projectDir, 'package.json');

        let runScript = 'npm run dev';

        if (fs.existsSync(pkgJsonPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            if (pkg.scripts?.dev) {
              runScript = 'npm run dev';
            } else if (pkg.scripts?.start) {
              runScript = 'npm start';
            } else if (pkg.main) {
              runScript = `node ${pkg.main}`;
            }
          } catch {}
        }

        // Check if node_modules exists, if not install first
        const nodeModulesPath = path.join(projectDir, 'node_modules');
        const needsInstall = !fs.existsSync(nodeModulesPath) && fs.existsSync(pkgJsonPath);

        const command = needsInstall
          ? `npm install && ${runScript}`
          : runScript;

        socket.emit('runner:output', {
          type: 'system',
          content: `[Running project: ${command}]`,
        });

        // Trigger command execution
        socket.emit('runner:exec-command', { command, projectId: targetProjectId });
      } catch (err) {
        emitError(socket, err.message, 'RUNNER_RUN_PROJECT_FAILED');
      }
    });

    // ─── Kill Running Process ──────────────────────────
    socket.on('runner:kill-process', ({ projectId } = {}) => {
      const targetProjectId = projectId || socket.projectId || codeServerService.findProjectBySocket(socket.id);
      if (!targetProjectId) return;

      const abort = activeProjectExecs.get(targetProjectId);
      if (abort) {
        abort();
        activeProjectExecs.delete(targetProjectId);
        namespace.to(`project:${targetProjectId}`).emit('runner:output', {
          type: 'system',
          content: '[Process killed by user]',
        });
      }
    });

    // ─── Destroy Container ─────────────────────────────
    socket.on('runner:destroy-container', async ({ projectId } = {}) => {
      const targetProjectId = projectId || socket.projectId;
      if (!targetProjectId) return;

      try {
        fileMaterializer.stopWatcher(targetProjectId);

        const projectDir = fileMaterializer.getProjectDir(targetProjectId);
        fileMaterializer.cleanup(projectDir);

        await codeServerService.stopContainer(targetProjectId);

        namespace.to(`project:${targetProjectId}`).emit('runner:container-destroyed');
        namespace.to(`project:${targetProjectId}`).emit('runner:output', {
          type: 'system',
          content: '[Container destroyed and files cleaned up]',
        });
      } catch (err) {
        logger.warn({ error: err.message }, 'Error destroying container');
        emitError(socket, err.message, 'RUNNER_DESTROY_FAILED');
      }
    });

    // ─── Interactive PTY Terminal Sessions ────────────────
    socket.on('terminal:init', async ({ projectId, sessionId = 'default', cols = 80, rows = 24 } = {}) => {
      try {
        const targetProjectId = projectId || socket.projectId;
        if (!targetProjectId) {
          return emitError(socket, 'Project ID is required', 'TERMINAL_MISSING_PROJECT');
        }

        await permissionService.can(socket.userId, targetProjectId, 'COLLABORATE');

        if (socket.projectId && socket.projectId !== targetProjectId) {
          socket.leave(`project:${socket.projectId}`);
        }
        socket.projectId = targetProjectId;
        socket.join(`project:${targetProjectId}`);

        const projectDir = fileMaterializer.getProjectDir(targetProjectId);
        if (!fs.existsSync(projectDir)) {
          socket.emit('terminal:data', {
            sessionId,
            data: '\r\n\x1b[33m[Materializing project files from database...]\x1b[0m\r\n',
          });
          await fileMaterializer.materialize(targetProjectId);
        }

        // Start filesystem watcher
        fileMaterializer.startWatcher(targetProjectId, io);

        // Ensure container is running and verified for this exact project
        let session = codeServerService.getSession(targetProjectId);
        if (!session) {
          socket.emit('terminal:data', {
            sessionId,
            data: '\r\n\x1b[34m[Starting Docker project container...]\x1b[0m\r\n',
          });
        }
        await codeServerService.startContainer(targetProjectId, projectDir, socket.id);

        const sessionKey = `${socket.id}:${sessionId}`;
        const existing = activeTerminalSessions.get(sessionKey);
        if (existing) {
          existing.kill();
          activeTerminalSessions.delete(sessionKey);
        }

        const terminalSession = await codeServerService.createTerminalSession(targetProjectId, {
          sessionId,
          cols,
          rows,
          onData: (data) => {
            socket.emit('terminal:data', { sessionId, data });
            if (data.includes('node_modules') || (data.includes('added') && data.includes('packages'))) {
              checkAndBroadcastNodeModules(targetProjectId);
            }
          },
          onExit: (code) => {
            socket.emit('terminal:exit', { sessionId, code });
            activeTerminalSessions.delete(sessionKey);
            checkAndBroadcastNodeModules(targetProjectId);
          },
        });

        activeTerminalSessions.set(sessionKey, terminalSession);
        socket.emit('terminal:ready', { sessionId });

        // Broadcast current node_modules presence
        checkAndBroadcastNodeModules(targetProjectId);
      } catch (err) {
        logger.error({ error: err.message, projectId, sessionId }, 'Failed to initialize terminal session');
        socket.emit('terminal:data', {
          sessionId,
          data: `\r\n\x1b[31m[Failed to start terminal: ${err.message}]\x1b[0m\r\n`,
        });
      }
    });

    socket.on('terminal:data', async ({ sessionId = 'default', data } = {}) => {
      const sessionKey = `${socket.id}:${sessionId}`;
      const term = activeTerminalSessions.get(sessionKey);
      if (term && data) {
        if (socket.projectId) {
          try {
            await permissionService.can(socket.userId, socket.projectId, 'COLLABORATE');
          } catch (err) {
            term.kill();
            activeTerminalSessions.delete(sessionKey);
            socket.emit('terminal:data', {
              sessionId,
              data: '\r\n\x1b[31m[Viewer access: Terminal input is disabled]\x1b[0m\r\n',
            });
            socket.emit('terminal:exit', { sessionId, code: 1 });
            return;
          }
        }
        term.write(data);
      }
    });

    socket.on('terminal:resize', ({ sessionId = 'default', cols, rows } = {}) => {
      const sessionKey = `${socket.id}:${sessionId}`;
      const term = activeTerminalSessions.get(sessionKey);
      if (term && cols && rows) {
        term.resize(cols, rows);
      }
    });

    socket.on('terminal:kill', ({ sessionId = 'default' } = {}) => {
      const sessionKey = `${socket.id}:${sessionId}`;
      const term = activeTerminalSessions.get(sessionKey);
      if (term) {
        term.kill();
        activeTerminalSessions.delete(sessionKey);
      }
    });

    // ─── Disconnect Handler ────────────────────────────
    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Project runner socket disconnected');

      // Clean up interactive terminal sessions for this socket
      for (const [key, term] of activeTerminalSessions.entries()) {
        if (key.startsWith(`${socket.id}:`)) {
          term.kill();
          activeTerminalSessions.delete(key);
        }
      }

      const targetProjectId = socket.projectId || codeServerService.findProjectBySocket(socket.id);
      if (targetProjectId) {
        codeServerService.removeUser(targetProjectId, socket.id);
      }
    });
  });

  function checkAndBroadcastNodeModules(projectId) {
    try {
      const projectDir = fileMaterializer.getProjectDir(projectId);
      const nodeModulesPath = path.join(projectDir, 'node_modules');
      const exists = fs.existsSync(nodeModulesPath);
      namespace.to(`project:${projectId}`).emit('runner:node-modules-status', {
        projectId,
        hasNodeModules: exists,
      });
    } catch {}
  }

  // Graceful shutdown helper
  return {
    async close() {
      await codeServerService.destroyAll();
    },
  };
}

/**
 * Emit a structured error to the client.
 */
function emitError(socket, message, code) {
  socket.emit('runner:error', { message, code });
  socket.emit('runner:output', {
    type: 'error',
    content: `Error: ${message}`,
  });
}

/**
 * Revoke terminal sessions for a specific user in a project (e.g. When demoted to Viewer).
 */
function revokeUserTerminalSessions(projectId, userId) {
  try {
    if (runnerNamespace) {
      for (const [socketId, socket] of runnerNamespace.sockets) {
        if (socket.userId === userId && (!projectId || socket.projectId === projectId)) {
          for (const [sessionKey, term] of activeTerminalSessions.entries()) {
            if (sessionKey.startsWith(`${socketId}:`)) {
              const sessionId = sessionKey.split(':')[1] || 'default';
              socket.emit('terminal:data', {
                sessionId,
                data: '\r\n\x1b[31m[Permission revoked: Role changed to Viewer. Terminal access terminated.]\x1b[0m\r\n',
              });
              socket.emit('terminal:exit', { sessionId, code: 1 });
              term.kill();
              activeTerminalSessions.delete(sessionKey);
            }
          }
          socket.emit('runner:error', {
            message: 'Viewer access: terminal and execution permissions revoked',
            code: 'INSUFFICIENT_PERMISSIONS',
          });
        }
      }
    }
  } catch (err) {
    logger.warn({ error: err.message, projectId, userId }, 'Error revoking user terminal sessions');
  }
}

module.exports = { setupProjectRunnerGateway, revokeUserTerminalSessions };
