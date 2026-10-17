/**
 * Project business logic.
 */

const projectRepository = require('./project.repository');
const activityService = require('../activities/activity.service');
const AppError = require('../../common/errors/AppError');
const ERROR_CODES = require('../../common/errors/errorCodes');

async function createProject(data, userId) {
  const project = await projectRepository.createWithOwner(data, userId);

  // Log activity
  await activityService.log({
    projectId: project.id,
    userId,
    action: 'PROJECT_CREATED',
    metadata: { projectName: project.name },
  });

  return project;
}

async function getUserProjects(userId) {
  return projectRepository.findByUserId(userId);
}

async function getProjectById(projectId) {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw AppError.notFound('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }
  return project;
}

async function updateProject(projectId, data, userId) {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw AppError.notFound('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  const updated = await projectRepository.update(projectId, data);

  await activityService.log({
    projectId,
    userId,
    action: 'PROJECT_UPDATED',
    metadata: { changes: data },
  });

  return updated;
}

async function deleteProject(projectId, userId) {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw AppError.notFound('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  // Cascading delete handles members, files, folders, messages, activities
  await projectRepository.remove(projectId);
}

module.exports = { createProject, getUserProjects, getProjectById, updateProject, deleteProject };
