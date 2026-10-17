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

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/files', fileRouter);
router.use('/folders', folderRouter);
router.use('/ai', aiRoutes);
router.use('/execution', executionRoutes);


router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'CodeCollabAI backend',
  });
});

module.exports = router;
