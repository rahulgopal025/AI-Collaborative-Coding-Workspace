/**
 * File and folder business logic.
 */

const fileRepository = require('./file.repository');
const permissionService = require('../permissions/permission.service');
const activityService = require('../activities/activity.service');
const AppError = require('../../common/errors/AppError');
const ERROR_CODES = require('../../common/errors/errorCodes');

// ─── File Operations ─────────────────────────────────────

async function createFile(projectId, data, userId) {
  await permissionService.can(userId, projectId, 'FILE_CREATE');

  const file = await fileRepository.createFile({ ...data, projectId });

  await activityService.log({
    projectId,
    userId,
    action: 'FILE_CREATED',
    metadata: { fileName: file.name, fileId: file.id },
  });

  return file;
}

async function getProjectFiles(projectId, userId) {
  await permissionService.can(userId, projectId, 'FILE_READ');

  const files = await fileRepository.findFilesByProjectId(projectId);
  const folders = await fileRepository.findFoldersByProjectId(projectId);

  return { files, folders };
}

async function getFileById(fileId, userId) {
  const file = await fileRepository.findFileById(fileId);
  if (!file) {
    throw AppError.notFound('File not found', ERROR_CODES.FILE_NOT_FOUND);
  }

  await permissionService.can(userId, file.projectId, 'FILE_READ');

  return file;
}

async function updateFile(fileId, data, userId) {
  const file = await fileRepository.findFileById(fileId);
  if (!file) {
    throw AppError.notFound('File not found', ERROR_CODES.FILE_NOT_FOUND);
  }

  await permissionService.can(userId, file.projectId, 'FILE_UPDATE');

  const updated = await fileRepository.updateFile(fileId, data);

  await activityService.log({
    projectId: file.projectId,
    userId,
    action: 'FILE_UPDATED',
    metadata: { fileName: file.name, fileId },
  });

  return updated;
}

async function deleteFile(fileId, userId) {
  const file = await fileRepository.findFileById(fileId);
  if (!file) {
    throw AppError.notFound('File not found', ERROR_CODES.FILE_NOT_FOUND);
  }

  await permissionService.can(userId, file.projectId, 'FILE_DELETE');

  await fileRepository.deleteFile(fileId);

  await activityService.log({
    projectId: file.projectId,
    userId,
    action: 'FILE_DELETED',
    metadata: { fileName: file.name },
  });
}

// ─── Folder Operations ──────────────────────────────────

async function createFolder(projectId, data, userId) {
  await permissionService.can(userId, projectId, 'FILE_CREATE');

  const folder = await fileRepository.createFolder({ ...data, projectId });

  await activityService.log({
    projectId,
    userId,
    action: 'FOLDER_CREATED',
    metadata: { folderName: folder.name, folderId: folder.id },
  });

  return folder;
}

async function updateFolder(folderId, data, userId) {
  const folder = await fileRepository.findFolderById(folderId);
  if (!folder) {
    throw AppError.notFound('Folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
  }

  await permissionService.can(userId, folder.projectId, 'FILE_UPDATE');

  return fileRepository.updateFolder(folderId, data);
}

async function deleteFolder(folderId, userId) {
  const folder = await fileRepository.findFolderById(folderId);
  if (!folder) {
    throw AppError.notFound('Folder not found', ERROR_CODES.FOLDER_NOT_FOUND);
  }

  await permissionService.can(userId, folder.projectId, 'FILE_DELETE');

  await fileRepository.deleteFolder(folderId);

  await activityService.log({
    projectId: folder.projectId,
    userId,
    action: 'FOLDER_DELETED',
    metadata: { folderName: folder.name },
  });
}

module.exports = {
  createFile,
  getProjectFiles,
  getFileById,
  updateFile,
  deleteFile,
  createFolder,
  updateFolder,
  deleteFolder,
};
