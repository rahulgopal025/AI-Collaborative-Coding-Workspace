/**
 * Activity service.
 * Reusable activity logging and retrieval.
 *
 * Usage:
 *   await activityService.log({ projectId, userId, action, metadata });
 */

const activityRepository = require('./activity.repository');
const logger = require('../../common/utils/logger');

/**
 * Log a project activity.
 * @param {{ projectId: string, userId: string, action: string, metadata?: object }} data
 */
async function log(data) {
  try {
    await activityRepository.create(data);
  } catch (error) {
    // Activity logging should never crash the main operation
    logger.error({ error: error.message, data }, 'Failed to log activity');
  }
}

/**
 * Get paginated activities for a project.
 */
async function getProjectActivities(projectId, pagination) {
  return activityRepository.findByProjectId(projectId, pagination);
}

module.exports = { log, getProjectActivities };
