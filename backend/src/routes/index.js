/**
 * Central API Router.
 * Mounts all module routes.
 */

const { Router } = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/user.routes');
const projectRoutes = require('../modules/projects/project.routes');
const { fileRouter, folderRouter } = require('../modules/files/file.routes');
const aiRoutes = require('../modules/ai/ai.routes');
const executionRoutes = require('../modules/execution/execution.routes');
const projectRunnerRoutes = require('../modules/projectRunner/projectRunner.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/files', fileRouter);
router.use('/folders', folderRouter);
router.use('/ai', aiRoutes);
router.use('/execution', executionRoutes);
router.use('/project-runner', projectRunnerRoutes);

const { authenticate } = require('../middlewares/auth.middleware');
const permissionService = require('../modules/permissions/permission.service');
const fileMaterializer = require('../modules/projectRunner/fileMaterializer');
const { sendSuccess } = require('../common/utils/response');

router.post('/local/projects/:projectId/write-to-disk', authenticate, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    await permissionService.can(req.user.id, projectId, 'COLLABORATE');
    const { projectDir, fileCount } = await fileMaterializer.materialize(projectId);
    return sendSuccess(res, {
      path: '/workspace',
      hostPath: projectDir,
      filesWritten: fileCount,
    });
  } catch (error) {
    next(error);
  }
});


router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'CodeCollabAI backend',
  });
});

module.exports = router;