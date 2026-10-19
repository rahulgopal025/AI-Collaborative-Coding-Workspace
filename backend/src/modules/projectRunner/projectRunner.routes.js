/**
 * Project Runner REST API routes.
 * Provides HTTP endpoints for managing code-server containers and
 * proxying access to running workspaces.
 *
 * Routes:
 *   GET  /api/project-runner/status              — Check Docker and image availability
 *   POST /api/project-runner/:projectId/start     — Start code-server for a project
 *   POST /api/project-runner/:projectId/stop      — Stop code-server for a project
 *   GET  /api/project-runner/:projectId/info      — Get running container info
 */

const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const permissionService = require('../permissions/permission.service');
const codeServerService = require('./codeServer.service');
const fileMaterializer = require('./fileMaterializer');
const { sendSuccess, sendError } = require('../../common/utils/response');
const logger = require('../../common/utils/logger');

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/project-runner/status
 * Check if Docker is available and the code-server image is ready.
 */
router.get('/status', async (req, res, next) => {
  try {
    const status = await codeServerService.checkStatus();
    return sendSuccess(res, status);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/project-runner/:projectId/start
 * Start a code-server container for a project.
 * Materializes project files from DB and starts the container.
 */
router.post('/:projectId/start', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Authorization check
    await permissionService.can(req.user.id, projectId, 'COLLABORATE');

    // Materialize project files from DB to disk
    const { projectDir, fileCount } = await fileMaterializer.materialize(projectId);

    logger.info(
      { projectId, userId: req.user.id, fileCount, projectDir },
      'Starting code-server for project'
    );

    // Start or join existing code-server container
    // Use a dummy socketId for REST API calls (will be replaced by actual socket connection)
    const socketId = `rest-${req.user.id}-${Date.now()}`;
    const result = await codeServerService.startContainer(projectId, projectDir, socketId);

    return sendSuccess(res, {
      containerId: result.containerId,
      port: result.port,
      previewPorts: result.previewPorts,
      password: result.password,
      url: `/workspace/${projectId}/`,
      previewUrl: `/api/project-runner/${projectId}/preview/`,
      isNew: result.isNew,
      fileCount,
    }, result.isNew ? 201 : 200);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/project-runner/:projectId/stop
 * Stop and remove the code-server container for a project.
 */
router.post('/:projectId/stop', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Authorization check
    await permissionService.can(req.user.id, projectId, 'COLLABORATE');

    const session = codeServerService.getSession(projectId);
    if (!session) {
      return sendError(res, 'No running container for this project', 404, 'RUNNER_NOT_FOUND');
    }

    // Clean up materialized files
    if (session.projectDir) {
      fileMaterializer.cleanup(session.projectDir);
    }

    await codeServerService.stopContainer(projectId);

    return sendSuccess(res, { message: 'Container stopped and removed' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/project-runner/:projectId/info
 * Get information about a running code-server container.
 */
router.get('/:projectId/info', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Authorization check
    await permissionService.can(req.user.id, projectId, 'COLLABORATE');

    const session = codeServerService.getSession(projectId);
    if (!session) {
      return sendSuccess(res, { running: false });
    }

    return sendSuccess(res, {
      running: true,
      containerId: session.containerId,
      port: session.port,
      previewPorts: session.previewPorts,
      password: session.password,
      url: `/workspace/${projectId}/`,
      previewUrl: `/api/project-runner/${projectId}/preview/`,
      createdAt: session.createdAt,
      userCount: session.users.size,
      uptimeMs: Date.now() - session.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/project-runner/:projectId/node-modules
 * Check if node_modules exists on disk for the project.
 */
router.get('/:projectId/node-modules', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    await permissionService.can(req.user.id, projectId, 'COLLABORATE');

    const fs = require('fs');
    const path = require('path');
    const projectDir = fileMaterializer.getProjectDir(projectId);
    const nodeModulesPath = path.join(projectDir, 'node_modules');
    const exists = fs.existsSync(nodeModulesPath);
    let packageCount = 0;

    if (exists) {
      try {
        packageCount = fs.readdirSync(nodeModulesPath).filter((f) => !f.startsWith('.')).length;
      } catch {}
    }

    return sendSuccess(res, { hasNodeModules: exists, packageCount });
  } catch (error) {
    next(error);
  }
});

module.exports = router;


