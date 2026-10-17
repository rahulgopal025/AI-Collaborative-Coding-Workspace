/**
 * Project controller.
 */

const projectService = require('./project.service');
const { sendSuccess } = require('../../common/utils/response');

async function create(req, res, next) {
  try {
    const project = await projectService.createProject(req.body, req.user.id);
    return sendSuccess(res, project, 201);
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const projects = await projectService.getUserProjects(req.user.id);
    return sendSuccess(res, projects);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const project = await projectService.getProjectById(req.params.projectId);
    return sendSuccess(res, project);
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const project = await projectService.updateProject(
      req.params.projectId,
      req.body,
      req.user.id
    );
    return sendSuccess(res, project);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await projectService.deleteProject(req.params.projectId, req.user.id);
    return sendSuccess(res, { message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = { create, list, getById, update, remove };
