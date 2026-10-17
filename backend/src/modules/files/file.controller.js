/**
 * File and folder controller.
 */

const fileService = require('./file.service');
const { sendSuccess } = require('../../common/utils/response');

// ─── File Operations ─────────────────────────────────────

async function createFile(req, res, next) {
  try {
    const file = await fileService.createFile(req.params.projectId, req.body, req.user.id);
    return sendSuccess(res, file, 201);
  } catch (error) {
    next(error);
  }
}

async function listFiles(req, res, next) {
  try {
    const data = await fileService.getProjectFiles(req.params.projectId, req.user.id);
    return sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function getFile(req, res, next) {
  try {
    const file = await fileService.getFileById(req.params.fileId, req.user.id);
    return sendSuccess(res, file);
  } catch (error) {
    next(error);
  }
}

async function updateFile(req, res, next) {
  try {
    const file = await fileService.updateFile(req.params.fileId, req.body, req.user.id);
    return sendSuccess(res, file);
  } catch (error) {
    next(error);
  }
}

async function deleteFile(req, res, next) {
  try {
    await fileService.deleteFile(req.params.fileId, req.user.id);
    return sendSuccess(res, { message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
}

// ─── Folder Operations ──────────────────────────────────

async function createFolder(req, res, next) {
  try {
    const folder = await fileService.createFolder(req.params.projectId, req.body, req.user.id);
    return sendSuccess(res, folder, 201);
  } catch (error) {
    next(error);
  }
}

async function updateFolder(req, res, next) {
  try {
    const folder = await fileService.updateFolder(req.params.folderId, req.body, req.user.id);
    return sendSuccess(res, folder);
  } catch (error) {
    next(error);
  }
}

async function deleteFolder(req, res, next) {
  try {
    await fileService.deleteFolder(req.params.folderId, req.user.id);
    return sendSuccess(res, { message: 'Folder deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createFile,
  listFiles,
  getFile,
  updateFile,
  deleteFile,
  createFolder,
  updateFolder,
  deleteFolder,
};
