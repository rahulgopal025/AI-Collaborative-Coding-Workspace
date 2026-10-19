/**
 * File and folder repository.
 * Database operations for files and folders.
 */

const { prisma } = require('../../config/database');

// ─── File Operations ─────────────────────────────────────

async function createFile(data) {
  return prisma.file.create({
    data: {
      name: data.name,
      content: data.content || '',
      language: data.language,
      projectId: data.projectId,
      folderId: data.folderId || null,
    },
  });
}

async function findFileById(id) {
  return prisma.file.findUnique({
    where: { id },
    include: {
      folder: { select: { id: true, name: true } },
    },
  });
}

async function findFilesByProjectId(projectId) {
  return prisma.file.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      content: true,
      language: true,
      folderId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });
}

async function updateFile(id, data) {
  return prisma.file.update({
    where: { id },
    data,
  });
}

async function deleteFile(id) {
  return prisma.file.delete({
    where: { id },
  });
}

// ─── Folder Operations ──────────────────────────────────

async function createFolder(data) {
  return prisma.folder.create({
    data: {
      name: data.name,
      projectId: data.projectId,
      parentId: data.parentId || null,
    },
  });
}

async function findFolderById(id) {
  return prisma.folder.findUnique({
    where: { id },
    include: {
      children: { select: { id: true, name: true } },
      files: { select: { id: true, name: true, language: true } },
      parent: { select: { id: true, name: true } },
    },
  });
}

async function findFoldersByProjectId(projectId) {
  return prisma.folder.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      parentId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });
}

async function updateFolder(id, data) {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;

  return prisma.folder.update({
    where: { id },
    data: updateData,
  });
}

async function deleteFolder(id) {
  // Cascading delete will remove child folders and files (set in Prisma schema)
  return prisma.folder.delete({
    where: { id },
  });
}

async function findFileByNameAndFolder(projectId, folderId, name) {
  return prisma.file.findFirst({
    where: {
      projectId,
      folderId: folderId || null,
      name,
    },
  });
}

async function findFolderByNameAndParent(projectId, parentId, name) {
  return prisma.folder.findFirst({
    where: {
      projectId,
      parentId: parentId || null,
      name,
    },
  });
}

module.exports = {
  createFile,
  findFileById,
  findFileByNameAndFolder,
  findFilesByProjectId,
  updateFile,
  deleteFile,
  createFolder,
  findFolderById,
  findFolderByNameAndParent,
  findFoldersByProjectId,
  updateFolder,
  deleteFolder,
};
