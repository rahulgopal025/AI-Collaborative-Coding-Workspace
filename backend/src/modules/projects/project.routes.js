/**
 * Project routes.
 * POST   /api/projects            - Create a project
 * GET    /api/projects            - List user's projects
 * GET    /api/projects/:projectId - Get project details
 * PUT    /api/projects/:projectId - Update project
 * DELETE /api/projects/:projectId - Delete project
 */

const { Router } = require('express');
const projectController = require('./project.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireProjectRole, requireProjectMember } = require('../../middlewares/role.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { createProjectSchema, updateProjectSchema, projectIdParamSchema } = require('./project.validator');

const router = Router();

// All project routes require authentication
router.use(authenticate);

router.post('/', validate(createProjectSchema), projectController.create);
router.get('/', projectController.list);

router.get(
  '/:projectId',
  validate(projectIdParamSchema, 'params'),
  requireProjectMember,
  projectController.getById
);

router.put(
  '/:projectId',
  validate(projectIdParamSchema, 'params'),
  requireProjectRole('OWNER'),
  validate(updateProjectSchema),
  projectController.update
);

router.patch(
  '/:projectId',
  validate(projectIdParamSchema, 'params'),
  requireProjectRole('OWNER'),
  validate(updateProjectSchema),
  projectController.update
);

const memberRoutes = require('../members/member.routes');
const chatRoutes = require('../chat/chat.routes');
const activityRoutes = require('../activities/activity.routes');
const { projectFileRouter, projectFolderRouter } = require('../files/file.routes');

router.delete(
  '/:projectId',
  validate(projectIdParamSchema, 'params'),
  requireProjectRole('OWNER'),
  projectController.remove
);

// Mount sub-routers
router.use('/:projectId/members', memberRoutes);
router.use('/:projectId/collaborators', memberRoutes);
router.use('/:projectId/messages', chatRoutes);
router.use('/:projectId/activities', activityRoutes);
router.use('/:projectId/files', projectFileRouter);
router.use('/:projectId/folders', projectFolderRouter);

module.exports = router;
