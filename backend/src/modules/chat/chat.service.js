/**
 * Chat service.
 * Business logic for project messaging.
 */

const chatRepository = require('./chat.repository');
const permissionService = require('../permissions/permission.service');
const activityService = require('../activities/activity.service');
const AppError = require('../../common/errors/AppError');
const ERROR_CODES = require('../../common/errors/errorCodes');

async function sendMessage(projectId, userId, content) {
  await permissionService.can(userId, projectId, 'CHAT_SEND');

  if (!content || !content.trim()) {
    throw AppError.badRequest('Message cannot be empty', ERROR_CODES.MESSAGE_EMPTY);
  }

  const message = await chatRepository.create({
    content: content.trim(),
    userId,
    projectId,
  });

  await activityService.log({
    projectId,
    userId,
    action: 'MESSAGE_SENT',
    metadata: { messageId: message.id },
  });

  return message;
}

async function getProjectMessages(projectId, userId, pagination) {
  await permissionService.can(userId, projectId, 'FILE_READ');
  return chatRepository.findByProjectId(projectId, pagination);
}

async function deleteMessage(messageId, userId, projectId) {
  const message = await chatRepository.findById(messageId);
  if (!message) {
    throw AppError.notFound('Message not found', ERROR_CODES.NOT_FOUND);
  }

  if (message.projectId !== projectId) {
    throw AppError.badRequest('Message does not belong to this project', ERROR_CODES.VALIDATION_ERROR);
  }

  // Only the author or a project admin/owner can delete
  if (message.userId !== userId) {
    await permissionService.can(userId, projectId, 'PROJECT_UPDATE'); // Or a generic admin check
  }

  await chatRepository.remove(messageId);

  await activityService.log({
    projectId,
    userId,
    action: 'MESSAGE_DELETED',
    metadata: { messageId },
  });
}

module.exports = { sendMessage, getProjectMessages, deleteMessage };
