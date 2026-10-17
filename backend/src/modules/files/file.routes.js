/**
 * File and folder routes.
 *
 * Files:
 * POST   /api/projects/:projectId/files      - Create file
 * GET    /api/projects/:projectId/files      - List files & folders
 * GET    /api/files/:fileId                  - Get file content
 * PUT    /api/files/:fileId                  - Update file
 * DELETE /api/files/:fileId                  - Delete file
 *
 * Folders:
 * POST   /api/projects/:projectId/folders    - Create folder
 * PUT    /api/folders/:folderId              - Update folder
 * DELETE /api/folders/:folderId              - Delete folder
 */

const { Router } = require('express');
const fileController = require('./file.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const {
  createFileSchema,
  updateFileSchema,
  createFolderSchema,
  updateFolderSchema,
  fileIdParamSchema,
  folderIdParamSchema,
} = require('./file.validator');
const { projectIdParamSchema } = require('../projects/project.validator');

// Project-scoped routes (mounted under /api/projects/:projectId)
const projectFileRouter = Router({ mergeParams: true });
projectFileRouter.use(authenticate);

projectFileRouter.post(
  '/',
  validate(projectIdParamSchema, 'params'),
  validate(createFileSchema),
  fileController.createFile
);

projectFileRouter.get(
  '/',
  validate(projectIdParamSchema, 'params'),
  fileController.listFiles
);

// Project-scoped folder routes
const projectFolderRouter = Router({ mergeParams: true });
projectFolderRouter.use(authenticate);

projectFolderRouter.post(
  '/',
  validate(projectIdParamSchema, 'params'),
  validate(createFolderSchema),
  fileController.createFolder
);

// Standalone file routes (mounted under /api/files)
const fileRouter = Router();
fileRouter.use(authenticate);

fileRouter.get(
  '/:fileId',
  validate(fileIdParamSchema, 'params'),
  fileController.getFile
);

fileRouter.put(
  '/:fileId',
  validate(fileIdParamSchema, 'params'),
  validate(updateFileSchema),
  fileController.updateFile
);

fileRouter.patch(
  '/:fileId',
  validate(fileIdParamSchema, 'params'),
  validate(updateFileSchema),
  fileController.updateFile
);

fileRouter.delete(
  '/:fileId',
  validate(fileIdParamSchema, 'params'),
  fileController.deleteFile
);

// Standalone folder routes (mounted under /api/folders)
const folderRouter = Router();
folderRouter.use(authenticate);

folderRouter.put(
  '/:folderId',
  validate(folderIdParamSchema, 'params'),
  validate(updateFolderSchema),
  fileController.updateFolder
);

folderRouter.patch(
  '/:folderId',
  validate(folderIdParamSchema, 'params'),
  validate(updateFolderSchema),
  fileController.updateFolder
);

folderRouter.delete(
  '/:folderId',
  validate(folderIdParamSchema, 'params'),
  fileController.deleteFolder
);

module.exports = { projectFileRouter, projectFolderRouter, fileRouter, folderRouter };
