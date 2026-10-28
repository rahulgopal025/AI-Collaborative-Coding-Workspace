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

let docker = getDockerClient();

/**
 * Ensure Docker daemon is reachable, with automatic Windows named pipe fallback.
 * @returns {Promise<Docker>}
 */
async function ensureConnectedDocker() {
  try {
    await docker.ping();
    return docker;
  } catch (err) {
    if (process.platform === 'win32' && !process.env.DOCKER_SOCKET_PATH) {
      // Try fallback to docker_engine named pipe if dockerDesktopLinuxEngine is unavailable
      try {
        const fallbackClient = new Docker({ socketPath: '//./pipe/docker_engine' });
        await fallbackClient.ping();
        logger.info('Connected to Docker via fallback pipe //./pipe/docker_engine');
        docker = fallbackClient;
        return docker;
      } catch {}
    }
    throw new Error(
      `Docker daemon is not running or unreachable (${err.message}). ` +
      `Please ensure Docker Desktop is started.`
    );
  }
}

/**
 * Docker image for code-server.
 * The official codercom/code-server includes Debian + code-server.
 * Node.js is installed at container start via an init script.
 */
const CODE_SERVER_IMAGE = 'codercom/code-server:latest';

/**
 * Known valid image names/aliases for CodeCollabAI project runner.
 */
const ACCEPTED_IMAGE_ALIASES = [
  'codercom/code-server:latest',
  'codercom/code-server',
  'codecollab/workspace:latest',
  'codecollab/workspace',
];

/**
 * Verify whether Docker daemon is reachable and resolve the available image name.
 * Checks direct inspect first, then scans local images via listImages().
 * @returns {Promise<string>} The verified image name to use
 */
async function resolveAndVerifyImage() {
  const client = await ensureConnectedDocker();

  // 1. Direct inspect check for primary image
  try {
    await client.getImage(CODE_SERVER_IMAGE).inspect();
    return CODE_SERVER_IMAGE;
  } catch (err) {
    // If it's a daemon connection error, rethrow the real error
    if (!err.statusCode || err.statusCode !== 404) {
      logger.warn({ error: err.message, statusCode: err.statusCode }, 'Docker image inspect error');
      throw new Error(`Docker connection error while inspecting image: ${err.message}`);
    }
  }

  // 2. Query all local images to find any accepted alias or matching tag
  try {
    const images = await client.listImages();
    for (const img of images) {
      if (img.RepoTags && Array.isArray(img.RepoTags)) {
        for (const tag of img.RepoTags) {
          if (
            ACCEPTED_IMAGE_ALIASES.includes(tag) ||
            tag.endsWith('/' + CODE_SERVER_IMAGE) ||
            tag.endsWith('/codecollab/workspace:latest')
          ) {
            logger.info({ matchedTag: tag, imageId: img.Id }, 'Resolved local Docker image via tag match');
            return tag;
          }
        }
      }
    }
  } catch (listErr) {
    logger.warn({ error: listErr.message }, 'Failed to list local Docker images');
    throw new Error(`Failed to list Docker images: ${listErr.message}`);
  }

  // 3. Truly not found locally
  throw new Error(
    `Docker image ${CODE_SERVER_IMAGE} not found locally in Docker Desktop. ` +
    `Pull it first: docker pull ${CODE_SERVER_IMAGE}`
  );
}

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
 * @returns {Promise<{ available: boolean, version?: string, imageReady?: boolean, error?: string, image?: string }>}
 */
async function checkStatus() {
  try {
    const client = await ensureConnectedDocker();
    const versionInfo = await client.version();
    let imageReady = false;

    try {
      await resolveAndVerifyImage();
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
    return { available: false, error: err.message, imageReady: false, image: CODE_SERVER_IMAGE };
  }
}

/**
 * Pull the code-server Docker image if not available locally.
 * @param {function} [onProgress] - Optional progress callback: (status: string) => void
 * @returns {Promise<void>}
 */
async function pullImage(onProgress) {
  try {
    await resolveAndVerifyImage();
    if (onProgress) onProgress('Image already available locally');
    return;
  } catch (err) {
    // If it's a daemon connection failure, rethrow
    if (err.message.includes('Docker daemon is not running')) {
      throw err;
    }
    // Image truly not found, proceed to pull
  }

  const client = await ensureConnectedDocker();
  if (onProgress) onProgress(`Pulling ${CODE_SERVER_IMAGE}... (this may take a few minutes)`);

  const stream = await client.pull(CODE_SERVER_IMAGE);
  await new Promise((resolve, reject) => {
    client.modem.followProgress(
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

/** In-flight container start promises to prevent race conditions */
const startingContainers = new Map();

/**
 * Scan Docker for an existing container belonging to this project.
 * If running and strictly matching project label AND workspace mount path,
 * adopt it into activeSessions and return the session info.
 * If stopped, dead, or misconfigured, safely remove it to prevent conflicts.
 */
async function findAndAdoptContainer(projectId, projectDir, socketId) {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: [`codecollab.project=${projectId}`] },
    });

    for (const info of containers) {
      const container = docker.getContainer(info.Id);
      if (info.State === 'running') {
        const inspect = await container.inspect();

        // 1. Strict label verification
        const containerProject = inspect.Config?.Labels?.['codecollab.project'];
        if (containerProject !== projectId) {
          logger.warn(
            { projectId, containerId: info.Id, containerProject },
            'Container project label mismatch during adoption — skipping'
          );
          continue;
        }

        // 2. Strict workspace mount verification
        const expectedDir = projectDir.replace(/\\/g, '/').toLowerCase();
        const mounts = inspect.Mounts || [];
        const workspaceMount = mounts.find((m) => m.Destination === '/workspace');
        if (workspaceMount) {
          const actualSource = workspaceMount.Source.replace(/\\/g, '/').toLowerCase();
          if (actualSource !== expectedDir) {
            logger.warn(
              { projectId, containerId: info.Id, expectedDir, actualSource },
              'Container mount path mismatch — stopping misconfigured container'
            );
            try {
              await container.stop({ t: 2 });
              await container.remove({ force: true });
            } catch {}
            continue;
          }
        }

        const hostPort = parseInt(inspect.NetworkSettings.Ports?.['8080/tcp']?.[0]?.HostPort, 10);
        const p5173 = parseInt(inspect.NetworkSettings.Ports?.['5173/tcp']?.[0]?.HostPort, 10);
        const p3000 = parseInt(inspect.NetworkSettings.Ports?.['3000/tcp']?.[0]?.HostPort, 10);
        const p5000 = parseInt(inspect.NetworkSettings.Ports?.['5000/tcp']?.[0]?.HostPort, 10);
        const pwdEnv = inspect.Config.Env?.find((e) => e.startsWith('PASSWORD='));
        const password = pwdEnv ? pwdEnv.split('=')[1] : '';

        let session = activeSessions.get(projectId);
        if (!session) {
          session = {
            container,
            containerId: info.Id,
            containerName: inspect.Name.replace(/^\//, ''),
            projectDir,
            port: hostPort,
            previewPorts: { 5173: p5173, 3000: p3000, 5000: p5000 },
            password,
            createdAt: new Date(inspect.Created).getTime(),
            timeoutId: null,
            users: new Set(),
          };
          activeSessions.set(projectId, session);
        }

        if (socketId) {
          session.users.add(socketId);
        }
        resetTimeout(projectId);

        logger.info(
          { projectId, socketId, containerId: session.containerId, port: session.port },
          'Reusing healthy, verified existing running code-server container from Docker'
        );

        return {
          port: session.port,
          password: session.password,
          containerId: session.containerId,
          previewPorts: session.previewPorts,
          isNew: false,
        };
      } else {
        // Container is stopped/created/exited/dead. Clean it up safely.
        try {
          await container.remove({ force: true });
          logger.info({ projectId, containerId: info.Id }, 'Cleaned up inactive container');
        } catch (e) {
          logger.debug({ error: e.message }, 'Failed to remove inactive container');
        }
      }
    }
  } catch (err) {
    logger.warn({ error: err.message, projectId }, 'Error inspecting Docker containers');
  }
  return null;
}

/**
 * Scan Docker on server startup to adopt any already-running containers and clean up dead ones.
 */
async function initialize() {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ['codecollab.managed=true'] },
    });

    for (const info of containers) {
      const projectId = info.Labels?.['codecollab.project'];
      if (!projectId) continue;

      const container = docker.getContainer(info.Id);
      if (info.State === 'running') {
        const inspect = await container.inspect();

        // Verify mount path matches this project's expected directory
        const fileMaterializer = require('./fileMaterializer');
        const projectDir = fileMaterializer.getProjectDir(projectId);
        const expectedDir = projectDir.replace(/\\/g, '/').toLowerCase();
        const mounts = inspect.Mounts || [];
        const workspaceMount = mounts.find((m) => m.Destination === '/workspace');
        if (workspaceMount) {
          const actualSource = workspaceMount.Source.replace(/\\/g, '/').toLowerCase();
          if (actualSource !== expectedDir) {
            logger.warn(
              { projectId, containerId: info.Id, expectedDir, actualSource },
              'Stale/mismatched container mount on startup — cleaning up'
            );
            try {
              await container.stop({ t: 2 });
              await container.remove({ force: true });
            } catch {}
            continue;
          }
        }

        const hostPort = parseInt(inspect.NetworkSettings.Ports?.['8080/tcp']?.[0]?.HostPort, 10);
        const p5173 = parseInt(inspect.NetworkSettings.Ports?.['5173/tcp']?.[0]?.HostPort, 10);
        const p3000 = parseInt(inspect.NetworkSettings.Ports?.['3000/tcp']?.[0]?.HostPort, 10);
        const p5000 = parseInt(inspect.NetworkSettings.Ports?.['5000/tcp']?.[0]?.HostPort, 10);
        const pwdEnv = inspect.Config.Env?.find((e) => e.startsWith('PASSWORD='));
        const password = pwdEnv ? pwdEnv.split('=')[1] : '';

        activeSessions.set(projectId, {
          container,
          containerId: info.Id,
          containerName: inspect.Name.replace(/^\//, ''),
          projectDir,
          port: hostPort,
          previewPorts: { 5173: p5173, 3000: p3000, 5000: p5000 },
          password,
          createdAt: new Date(inspect.Created).getTime(),
          timeoutId: null,
          users: new Set(),
        });

        logger.info(
          { projectId, containerId: info.Id, port: hostPort },
          'Adopted running container on startup'
        );
      } else {
        // Clean up stale non-running container
        try {
          await container.remove({ force: true });
          logger.info({ projectId, containerId: info.Id }, 'Cleaned up stale container on startup');
        } catch {}
      }
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Failed container auto-discovery on startup');
  }
}

/**
 * Start a code-server container for a project.
 * If a container already exists for the project, returns the existing session.
 *
 * @param {string} projectId
 * @param {string} projectDir - Absolute path to materialized project files on host
 * @param {string} socketId - The connecting socket's ID
 * @returns {Promise<{ port: number, password: string, containerId: string, previewPorts: object, isNew: boolean }>}
 */
async function startContainer(projectId, projectDir, socketId) {
  // 1. Return existing in-memory session if already active, running, and correctly mounted
  const existing = activeSessions.get(projectId);
  if (existing) {
    try {
      const inspect = await existing.container.inspect();
      if (!inspect.State?.Running) {
        logger.warn({ projectId, containerId: existing.containerId }, 'Existing container is not running — purging session');
        activeSessions.delete(projectId);
      } else {
        const expectedDir = projectDir.replace(/\\/g, '/').toLowerCase();
        const mounts = inspect.Mounts || [];
        const workspaceMount = mounts.find((m) => m.Destination === '/workspace');
        if (workspaceMount && workspaceMount.Source.replace(/\\/g, '/').toLowerCase() !== expectedDir) {
          logger.warn({ projectId, containerId: existing.containerId }, 'Existing container has wrong mount — removing');
          await stopContainer(projectId);
        } else {
          if (socketId) existing.users.add(socketId);
          resetTimeout(projectId);

          logger.info(
            { projectId, socketId, containerId: existing.containerId },
            'User joined verified existing code-server container'
          );

          return {
            port: existing.port,
            password: existing.password,
            containerId: existing.containerId,
            previewPorts: existing.previewPorts,
            isNew: false,
          };
        }
      }
    } catch (e) {
      logger.warn({ projectId, error: e.message }, 'Failed to inspect existing container — clearing session');
      activeSessions.delete(projectId);
    }
  }

  // 2. Concurrency protection: coalesce concurrent starts for the same project
  if (startingContainers.has(projectId)) {
    const result = await startingContainers.get(projectId);
    const session = activeSessions.get(projectId);
    if (session && socketId) {
      session.users.add(socketId);
      resetTimeout(projectId);
    }
    return result;
  }

  const startPromise = (async () => {
    // 3. Check Docker for an existing container (e.g. running before backend restart)
    const adopted = await findAndAdoptContainer(projectId, projectDir, socketId);
    if (adopted) {
      return adopted;
    }

    // 4. Verify and resolve the image available locally
    const verifiedImage = await resolveAndVerifyImage();

    const password = crypto.randomBytes(16).toString('hex');
    const containerName = `codecollab-cs-${projectId.substring(0, 8)}-${Date.now()}`;

    logger.info(
      { projectId, containerName, projectDir, image: verifiedImage },
      'Creating code-server container with dynamic host port bindings'
    );

    const client = await ensureConnectedDocker();

    // Bind host ports dynamically to loopback (HostPort: '') so Docker allocates guaranteed-free ports
    const container = await client.createContainer({
      Image: verifiedImage,
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
        'CHOKIDAR_USEPOLLING=true',
        'CHOKIDAR_INTERVAL=100',
        'WATCHPACK_POLLING=true',
      ],
      WorkingDir: '/workspace',
      HostConfig: {
        Binds: [`${projectDir.replace(/\\/g, '/')}:/workspace`],
        PortBindings: {
          '8080/tcp': [{ HostIp: '127.0.0.1', HostPort: '' }],
          '5173/tcp': [{ HostIp: '127.0.0.1', HostPort: '' }],
          '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '' }],
          '5000/tcp': [{ HostIp: '127.0.0.1', HostPort: '' }],
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
      Cmd: [
        '--bind-addr', '0.0.0.0:8080',
        '--auth', 'password',
        '--disable-telemetry',
        '/workspace',
      ],
    });

    try {
      await container.start();
    } catch (startErr) {
      logger.error({ projectId, error: startErr.message }, 'Failed to start container, removing...');
      try {
        await container.remove({ force: true });
      } catch {}
      throw startErr;
    }

    // Inspect the started container to extract Docker's dynamically assigned host ports
    const inspect = await container.inspect();
    const port = parseInt(inspect.NetworkSettings.Ports?.['8080/tcp']?.[0]?.HostPort, 10);
    const previewPorts = {
      5173: parseInt(inspect.NetworkSettings.Ports?.['5173/tcp']?.[0]?.HostPort, 10),
      3000: parseInt(inspect.NetworkSettings.Ports?.['3000/tcp']?.[0]?.HostPort, 10),
      5000: parseInt(inspect.NetworkSettings.Ports?.['5000/tcp']?.[0]?.HostPort, 10),
    };

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
      users: new Set(socketId ? [socketId] : []),
    });

    logger.info(
      { projectId, containerId: container.id, port, previewPorts, containerName },
      'code-server container started successfully'
    );

    return {
      port,
      previewPorts,
      password,
      containerId: container.id,
      isNew: true,
    };
  })();

  startingContainers.set(projectId, startPromise);
  try {
    return await startPromise;
  } finally {
    startingContainers.delete(projectId);
  }
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
 * Ensure session is active in memory. If not present in memory,
 * discovers and adopts any existing container for this project from Docker.
 * @param {string} projectId
 * @returns {Promise<object|null>}
 */
async function ensureSession(projectId) {
  let session = activeSessions.get(projectId);
  if (session) {
    try {
      const inspect = await session.container.inspect();
      if (inspect.State?.Running) {
        return session;
      }
      activeSessions.delete(projectId);
    } catch {
      activeSessions.delete(projectId);
    }
  }

  const fileMaterializer = require('./fileMaterializer');
  const projectDir = fileMaterializer.getProjectDir(projectId);
  await findAndAdoptContainer(projectId, projectDir);
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
  initialize,
  checkStatus,
  pullImage,
  startContainer,
  stopContainer,
  removeUser,
  executeCommand,
  createTerminalSession,
  getSession,
  ensureSession,
  findProjectBySocket,
  destroyAll,
  CODE_SERVER_IMAGE,
};
