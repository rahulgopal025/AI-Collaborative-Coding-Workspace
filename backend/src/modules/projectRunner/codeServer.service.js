/**
 * code-server Container Service.
 * Manages Docker containers running code-server (VS Code in browser)
 * for project-specific workspaces.
 *
 * Each project gets its own code-server container with:
 *   - Isolated workspace at /workspace (bind-mounted from host)
 *   - Node.js runtime available in the container
 *   - Password-protected access via per-session tokens
 *   - Resource limits (CPU, memory, PIDs)
 *   - Auto-cleanup on disconnect or timeout
 */

const Docker = require('dockerode');
const crypto = require('crypto');
const logger = require('../../common/utils/logger');
const {
  CONTAINER_LIMITS,
  MAX_CONTAINER_LIFETIME_MS,
} = require('./projectRunner.validator');

function getDockerClient() {
  if (process.platform === 'win32') {
    return new Docker({
      socketPath: process.env.DOCKER_SOCKET_PATH || '//./pipe/dockerDesktopLinuxEngine',
    });
  }
  return new Docker();
}

const docker = getDockerClient();

/**
 * Docker image for code-server.
 * The official codercom/code-server includes Debian + code-server.
 * Node.js is installed at container start via an init script.
 */
const CODE_SERVER_IMAGE = 'codercom/code-server:latest';

/**
 * Active code-server sessions, keyed by projectId.
 * Multiple users on the same project share one container.
 *
 * Each entry:
 * {
 *   container: Docker.Container,
 *   containerId: string,
 *   containerName: string,
 *   projectDir: string,
 *   port: number,
 *   previewPorts: { 5173: number, 3000: number, 5000: number },
 *   password: string,
 *   createdAt: number,
 *   timeoutId: NodeJS.Timeout,
 *   users: Set<string>,   // socket IDs of connected users
 * }
 */
const activeSessions = new Map();

/** Port allocation range for code-server containers */
let nextPort = 18080;
const PORT_RANGE_START = 18080;
const PORT_RANGE_END = 18180;

/**
 * Check if Docker is available and the code-server image exists locally.
 * @returns {Promise<{ available: boolean, version?: string, imageReady?: boolean, error?: string }>}
 */
async function checkStatus() {
  try {
    const versionInfo = await docker.version();
    let imageReady = false;

    try {
      await docker.getImage(CODE_SERVER_IMAGE).inspect();
      imageReady = true;
    } catch {
      imageReady = false;
    }

    return {
      available: true,
      version: versionInfo.Version,
      imageReady,
      image: CODE_SERVER_IMAGE,
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

/**
 * Pull the code-server Docker image if not available locally.
 * @param {function} [onProgress] - Optional progress callback: (status: string) => void
 * @returns {Promise<void>}
 */
async function pullImage(onProgress) {
  try {
    await docker.getImage(CODE_SERVER_IMAGE).inspect();
    if (onProgress) onProgress('Image already available locally');
    return;
  } catch {
    // Image not found, pull it
  }

  if (onProgress) onProgress(`Pulling ${CODE_SERVER_IMAGE}... (this may take a few minutes)`);

  const stream = await docker.pull(CODE_SERVER_IMAGE);
  await new Promise((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err) => {
        if (err) reject(err);
        else resolve();
      },
      (event) => {
        if (onProgress && event.status) {
          onProgress(`${event.status} ${event.progress || ''}`);
        }
      }
    );
  });

  if (onProgress) onProgress('Image pull complete');
}

/**
 * Allocate the next available port for a code-server container.
 * @returns {number}
 */
function allocatePort() {
  const usedPorts = new Set();
  for (const session of activeSessions.values()) {
    usedPorts.add(session.port);
  }

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }

  throw new Error('No available ports for code-server containers');
}

/**
 * Start a code-server container for a project.
 * If a container already exists for the project, returns the existing session.
 *
 * @param {string} projectId
 * @param {string} projectDir - Absolute path to materialized project files on host
 * @param {string} socketId - The connecting socket's ID
 * @returns {Promise<{ port: number, password: string, containerId: string, isNew: boolean }>}
 */
async function startContainer(projectId, projectDir, socketId) {
  // Return existing session if container is already running for this project
  const existing = activeSessions.get(projectId);
  if (existing) {
    existing.users.add(socketId);
    resetTimeout(projectId);

    logger.info(
      { projectId, socketId, containerId: existing.containerId },
      'User joined existing code-server container'
    );

    return {
      port: existing.port,
      password: existing.password,
      containerId: existing.containerId,
      isNew: false,
    };
  }

  // Verify the image is available
  try {
    await docker.getImage(CODE_SERVER_IMAGE).inspect();
  } catch {
    throw new Error(
      `Docker image ${CODE_SERVER_IMAGE} not found locally. ` +
      `Pull it first: docker pull ${CODE_SERVER_IMAGE}`
    );
  }

  const port = allocatePort();
  const password = crypto.randomBytes(16).toString('hex');
  const containerName = `codecollab-cs-${projectId.substring(0, 8)}-${Date.now()}`;

  const previewPorts = {
    5173: port + 100, // Vite dev server
    3000: port + 200, // React / Next dev server
    5000: port + 300, // Node.js / Express backend
  };

  logger.info(
    { projectId, port, previewPorts, containerName, projectDir },
    'Creating code-server container'
  );

  const container = await docker.createContainer({
    Image: CODE_SERVER_IMAGE,
    name: containerName,
    ExposedPorts: {
      '8080/tcp': {},
      '5173/tcp': {},
      '3000/tcp': {},
      '5000/tcp': {},
    },
    Env: [
      `PASSWORD=${password}`,
      'NODE_ENV=development',
      'NPM_CONFIG_UPDATE_NOTIFIER=false',
      'NPM_CONFIG_FUND=false',
    ],
    WorkingDir: '/workspace',
    HostConfig: {
      Binds: [`${projectDir.replace(/\\/g, '/')}:/workspace`],
      PortBindings: {
        '8080/tcp': [{ HostIp: '127.0.0.1', HostPort: String(port) }],
        '5173/tcp': [{ HostIp: '127.0.0.1', HostPort: String(previewPorts[5173]) }],
        '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: String(previewPorts[3000]) }],
        '5000/tcp': [{ HostIp: '127.0.0.1', HostPort: String(previewPorts[5000]) }],
      },
      Memory: CONTAINER_LIMITS.Memory,
      NanoCpus: CONTAINER_LIMITS.NanoCpus,
      PidsLimit: CONTAINER_LIMITS.PidsLimit,
      SecurityOpt: ['no-new-privileges'],
      AutoRemove: false,
    },
    Labels: {
      'codecollab.project': projectId,
      'codecollab.managed': 'true',
      'codecollab.type': 'code-server',
    },
    // code-server entrypoint handles its own command
    Cmd: [
      '--bind-addr', '0.0.0.0:8080',
      '--auth', 'password',
      '--disable-telemetry',
      '/workspace',
    ],
  });

  await container.start();

  const timeoutId = setTimeout(() => {
    logger.warn({ projectId }, 'code-server container lifetime exceeded');
    stopContainer(projectId);
  }, MAX_CONTAINER_LIFETIME_MS);

  activeSessions.set(projectId, {
    container,
    containerId: container.id,
    containerName,
    projectDir,
    port,
    previewPorts,
    password,
    createdAt: Date.now(),
    timeoutId,
    users: new Set([socketId]),
  });

  logger.info(
    { projectId, containerId: container.id, port, previewPorts, containerName },
    'code-server container started'
  );

  return {
    port,
    previewPorts,
    password,
    containerId: container.id,
    isNew: true,
  };
}

/**
 * Execute a command inside a project's container with streaming stdout/stderr.
 *
 * @param {string} projectId
 * @param {string} command - Validated command string
 * @param {function} onOutput - (type: 'stdout'|'stderr', data: string) => void
 * @param {function} onExit - (exitCode: number) => void
 * @returns {Promise<{ abort: () => void }>}
 */
async function executeCommand(projectId, command, onOutput, onExit) {
  const session = activeSessions.get(projectId);
  if (!session) {
    throw new Error(`No active container for project ${projectId}`);
  }

  resetTimeout(projectId);

  const exec = await session.container.exec({
    Cmd: ['bash', '-c', command],
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: false,
    Tty: false,
    WorkingDir: '/workspace',
  });

  let killed = false;

  const stream = await exec.start({ Detach: false, Tty: false });

  // Demux stdout and stderr from Docker's multiplexed stream
  session.container.modem.demuxStream(
    stream,
    {
      write(chunk) {
        if (!killed && onOutput) onOutput('stdout', chunk.toString('utf-8'));
      },
    },
    {
      write(chunk) {
        if (!killed && onOutput) onOutput('stderr', chunk.toString('utf-8'));
      },
    }
  );

  // Monitor for process completion
  const checkCompletion = setInterval(async () => {
    try {
      const inspectData = await exec.inspect();
      if (!inspectData.Running) {
        clearInterval(checkCompletion);
        if (!killed && onExit) {
          onExit(inspectData.ExitCode !== null ? inspectData.ExitCode : 0);
        }
      }
    } catch {
      clearInterval(checkCompletion);
    }
  }, 250);

  const abort = () => {
    killed = true;
    clearInterval(checkCompletion);
    try {
      stream.destroy();
    } catch {}
    if (onExit) onExit(-1);
  };

  return { abort };
}

/**
 * Create an interactive PTY terminal session inside the container.
 *
 * @param {string} projectId
 * @param {object} options
 * @param {string} options.sessionId
 * @param {number} [options.cols=80]
 * @param {number} [options.rows=24]
 * @param {function} options.onData - (data: string) => void
 * @param {function} [options.onExit] - (code: number) => void
 * @returns {Promise<{ write: (data: string) => void, resize: (cols: number, rows: number) => Promise<void>, kill: () => void }>}
 */
async function createTerminalSession(projectId, { sessionId, cols = 80, rows = 24, onData, onExit }) {
  const session = activeSessions.get(projectId);
  if (!session) {
    throw new Error(`No active container for project ${projectId}`);
  }

  resetTimeout(projectId);

  const exec = await session.container.exec({
    Cmd: ['bash'],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    WorkingDir: '/workspace',
    Env: [
      'TERM=xterm-256color',
      'COLORTERM=truecolor',
      'LANG=en_US.UTF-8',
      'NODE_ENV=development',
    ],
  });

  const stream = await new Promise((resolve, reject) => {
    exec.start({ hijack: true, stdin: true }, (err, str) => {
      if (err) return reject(err);
      resolve(str);
    });
  });

  if (cols && rows) {
    try {
      await exec.resize({ h: rows, w: cols });
    } catch (e) {
      logger.debug({ error: e.message }, 'Failed initial terminal resize');
    }
  }

  stream.on('data', (chunk) => {
    if (onData) onData(chunk.toString('utf-8'));
  });

  stream.on('end', () => {
    if (onExit) onExit(0);
  });

  stream.on('error', (err) => {
    logger.warn({ projectId, sessionId, error: err.message }, 'Terminal stream error');
  });

  return {
    write(data) {
      if (stream && !stream.destroyed) {
        stream.write(data);
      }
    },
    async resize(w, h) {
      try {
        await exec.resize({ h, w });
      } catch (err) {
        logger.debug({ error: err.message }, 'Terminal resize error');
      }
    },
    kill() {
      try {
        stream.write('\x03');
        stream.end();
      } catch {}
    },
  };
}

/**
 * Stop and remove a project's code-server container.
 * @param {string} projectId
 * @returns {Promise<void>}
 */
async function stopContainer(projectId) {
  const session = activeSessions.get(projectId);
  if (!session) return;

  const { container, timeoutId, containerId } = session;

  if (timeoutId) clearTimeout(timeoutId);

  try {
    await container.stop({ t: 5 }).catch(() => {});
    await container.remove({ force: true }).catch(() => {});
    logger.info({ projectId, containerId }, 'code-server container stopped');
  } catch (err) {
    logger.warn({ projectId, error: err.message }, 'Error stopping code-server container');
  }

  activeSessions.delete(projectId);
}

/**
 * Remove a user from a project session. If no users remain, stop the container
 * after a grace period.
 *
 * @param {string} projectId
 * @param {string} socketId
 */
function removeUser(projectId, socketId) {
  const session = activeSessions.get(projectId);
  if (!session) return;

  session.users.delete(socketId);

  if (session.users.size === 0) {
    // Grace period: keep container alive for 2 minutes in case user reconnects
    if (session.timeoutId) clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(() => {
      const currentSession = activeSessions.get(projectId);
      if (currentSession && currentSession.users.size === 0) {
        logger.info({ projectId }, 'No users remaining, stopping code-server container');
        stopContainer(projectId);
      }
    }, 2 * 60 * 1000);
  }
}

/**
 * Reset the auto-cleanup timeout for a project.
 * @param {string} projectId
 */
function resetTimeout(projectId) {
  const session = activeSessions.get(projectId);
  if (!session) return;

  if (session.timeoutId) clearTimeout(session.timeoutId);
  session.timeoutId = setTimeout(() => {
    logger.warn({ projectId }, 'code-server container lifetime exceeded');
    stopContainer(projectId);
  }, MAX_CONTAINER_LIFETIME_MS);
}

/**
 * Get session info for a project.
 * @param {string} projectId
 * @returns {object|null}
 */
function getSession(projectId) {
  return activeSessions.get(projectId) || null;
}

/**
 * Find which project a socket is connected to.
 * @param {string} socketId
 * @returns {string|null} projectId or null
 */
function findProjectBySocket(socketId) {
  for (const [projectId, session] of activeSessions) {
    if (session.users.has(socketId)) {
      return projectId;
    }
  }
  return null;
}

/**
 * Destroy all active code-server sessions. Called during graceful shutdown.
 * @returns {Promise<void>}
 */
async function destroyAll() {
  const projects = Array.from(activeSessions.keys());
  logger.info({ count: projects.length }, 'Destroying all code-server containers');

  await Promise.allSettled(projects.map((pid) => stopContainer(pid)));
}

module.exports = {
  checkStatus,
  pullImage,
  startContainer,
  stopContainer,
  removeUser,
  executeCommand,
  createTerminalSession,
  getSession,
  findProjectBySocket,
  destroyAll,
  CODE_SERVER_IMAGE,
};
