/**
 * Project Runner Service.
 * Manages Docker container lifecycle for project execution.
 *
 * Responsibilities:
 *   - Pull/verify the Node.js Docker image
 *   - Create containers with bind-mounted project files
 *   - Execute commands inside containers with streaming output
 *   - Enforce resource limits and timeouts
 *   - Clean up containers on disconnect or timeout
 */

const Docker = require('dockerode');
const logger = require('../../common/utils/logger');
const {
  CONTAINER_LIMITS,
  MAX_CONTAINER_LIFETIME_MS,
  NODE_DOCKER_IMAGE,
} = require('./projectRunner.validator');

// Docker client — connects via the default socket
// On Windows: //./pipe/docker_engine, on Linux/Mac: /var/run/docker.sock
const docker = new Docker();

/**
 * Active container sessions, keyed by `socketId`.
 * Each entry: { container, projectDir, projectId, createdAt, timeoutId }
 */
const activeSessions = new Map();

/**
 * Check if Docker is available and responsive.
 * @returns {Promise<{ available: boolean, version?: string, error?: string }>}
 */
async function checkDockerAvailability() {
  try {
    const info = await docker.version();
    return { available: true, version: info.Version };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

/**
 * Ensure the Node.js Docker image is available locally.
 * Pulls it if not present. Returns once the image is ready.
 *
 * @returns {Promise<void>}
 */
async function ensureImage() {
  try {
    const image = docker.getImage(NODE_DOCKER_IMAGE);
    await image.inspect();
    logger.debug({ image: NODE_DOCKER_IMAGE }, 'Docker image already available');
  } catch {
    logger.info({ image: NODE_DOCKER_IMAGE }, 'Pulling Docker image...');
    const stream = await docker.pull(NODE_DOCKER_IMAGE);
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    logger.info({ image: NODE_DOCKER_IMAGE }, 'Docker image pulled successfully');
  }
}

/**
 * Create a Docker container for a project.
 * The container is created but NOT started — commands are executed via `exec`.
 *
 * @param {string} socketId - The socket connection ID (used as session key)
 * @param {string} projectId - The project ID
 * @param {string} projectDir - Absolute path to the materialized project directory
 * @returns {Promise<{ containerId: string }>}
 */
async function createContainer(socketId, projectId, projectDir) {
  // Clean up any existing container for this socket
  await destroySession(socketId);

  await ensureImage();

  const containerName = `codecollab-${projectId.substring(0, 8)}-${Date.now()}`;

  const container = await docker.createContainer({
    Image: NODE_DOCKER_IMAGE,
    name: containerName,
    Cmd: ['sh', '-c', 'tail -f /dev/null'], // Keep container alive
    WorkingDir: '/app',
    HostConfig: {
      Binds: [`${projectDir}:/app`],
      Memory: CONTAINER_LIMITS.Memory,
      NanoCpus: CONTAINER_LIMITS.NanoCpus,
      PidsLimit: CONTAINER_LIMITS.PidsLimit,
      AutoRemove: false, // We handle cleanup manually
      SecurityOpt: ['no-new-privileges'],
    },
    // Environment
    Env: [
      'NODE_ENV=development',
      'NPM_CONFIG_UPDATE_NOTIFIER=false',
      'NPM_CONFIG_FUND=false',
    ],
    // Labels for identification
    Labels: {
      'codecollab.project': projectId,
      'codecollab.socket': socketId,
      'codecollab.managed': 'true',
    },
    // Don't attach stdin/stdout to the create call
    AttachStdin: false,
    AttachStdout: false,
    AttachStderr: false,
    Tty: false,
  });

  await container.start();

  // Set up auto-cleanup timeout
  const timeoutId = setTimeout(() => {
    logger.warn({ socketId, projectId, containerId: container.id }, 'Container lifetime exceeded, destroying');
    destroySession(socketId);
  }, MAX_CONTAINER_LIFETIME_MS);

  // Store session
  activeSessions.set(socketId, {
    container,
    projectDir,
    projectId,
    containerId: container.id,
    containerName,
    createdAt: Date.now(),
    timeoutId,
  });

  logger.info(
    { socketId, projectId, containerId: container.id, containerName },
    'Project container created and started'
  );

  return { containerId: container.id };
}

/**
 * Execute a command inside a project container with streaming output.
 *
 * @param {string} socketId
 * @param {string} command - The validated command to execute
 * @param {function} onOutput - Callback: (type: 'stdout'|'stderr', data: string) => void
 * @param {function} onExit - Callback: (exitCode: number) => void
 * @returns {Promise<{ exec: object, abort: function }>} An abort function to kill the exec
 */
async function executeCommand(socketId, command, onOutput, onExit) {
  const session = activeSessions.get(socketId);
  if (!session) {
    throw new Error('No active container session. Start a container first.');
  }

  const { container } = session;

  // Create an exec instance inside the container
  const exec = await container.exec({
    Cmd: ['sh', '-c', command],
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: false,
    Tty: false,
    WorkingDir: '/app',
  });

  // Start the exec and get the output stream
  const stream = await exec.start({ hijack: true, stdin: false });

  // Docker multiplexes stdout/stderr in a single stream.
  // We need to demux them.
  const stdoutChunks = [];
  const stderrChunks = [];

  // Use Docker's modem to demux the stream
  container.modem.demuxStream(stream, {
    write: (chunk) => {
      const text = chunk.toString('utf-8');
      stdoutChunks.push(text);
      onOutput('stdout', text);
    },
  }, {
    write: (chunk) => {
      const text = chunk.toString('utf-8');
      stderrChunks.push(text);
      onOutput('stderr', text);
    },
  });

  // Abort function — inspect and attempt to stop the exec process
  const abort = () => {
    try {
      stream.destroy();
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to abort exec stream');
    }
  };

  // Wait for the stream to end, then get exit code
  stream.on('end', async () => {
    try {
      const inspectData = await exec.inspect();
      const exitCode = inspectData.ExitCode ?? -1;
      onExit(exitCode);
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to inspect exec after completion');
      onExit(-1);
    }
  });

  stream.on('error', (err) => {
    logger.warn({ error: err.message }, 'Exec stream error');
    onOutput('stderr', `Stream error: ${err.message}\n`);
    onExit(-1);
  });

  return { exec, abort };
}

/**
 * Destroy a container session and clean up resources.
 *
 * @param {string} socketId
 * @returns {Promise<void>}
 */
async function destroySession(socketId) {
  const session = activeSessions.get(socketId);
  if (!session) return;

  const { container, timeoutId, containerId } = session;

  // Clear the auto-cleanup timeout
  if (timeoutId) clearTimeout(timeoutId);

  try {
    // Stop the container (5 second grace period)
    await container.stop({ t: 5 }).catch(() => {});
    // Remove the container
    await container.remove({ force: true }).catch(() => {});
    logger.info({ socketId, containerId }, 'Container destroyed');
  } catch (err) {
    logger.warn({ socketId, containerId, error: err.message }, 'Error destroying container');
  }

  activeSessions.delete(socketId);
}

/**
 * Get session info for a socket.
 *
 * @param {string} socketId
 * @returns {object|null}
 */
function getSession(socketId) {
  return activeSessions.get(socketId) || null;
}

/**
 * Destroy all active sessions. Called during graceful shutdown.
 *
 * @returns {Promise<void>}
 */
async function destroyAllSessions() {
  const entries = Array.from(activeSessions.keys());
  logger.info({ count: entries.length }, 'Destroying all project runner sessions');

  await Promise.allSettled(
    entries.map((socketId) => destroySession(socketId))
  );
}

module.exports = {
  checkDockerAvailability,
  ensureImage,
  createContainer,
  executeCommand,
  destroySession,
  getSession,
  destroyAllSessions,
};
