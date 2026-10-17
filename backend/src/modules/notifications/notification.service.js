/**
 * Notification service.
 * Creates notifications for important project events.
 */

const notificationRepository = require('./notification.repository');
const logger = require('../../common/utils/logger');

/**
 * Create a notification for a user.
 * @param {{ userId: string, projectId?: string, type: string, message: string }} data
 */
async function notify(data) {
  try {
    await notificationRepository.create(data);
  } catch (error) {
    // Notification failures should not crash the main operation
    logger.error({ error: error.message, data }, 'Failed to create notification');
  }
}

/**
 * Get notifications for a user with pagination.
 */
async function getUserNotifications(userId, pagination) {
  return notificationRepository.findByUserId(userId, pagination);
}

/**
 * Mark a notification as read.
 */
async function markAsRead(notificationId, userId) {
  return notificationRepository.markAsRead(notificationId, userId);
}

module.exports = { notify, getUserNotifications, markAsRead };
