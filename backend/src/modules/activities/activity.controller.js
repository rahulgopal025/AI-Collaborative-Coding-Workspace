/**
 * Activity controller.
 */

const activityService = require('./activity.service');
const { sendPaginated } = require('../../common/utils/response');

async function list(req, res, next) {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const { activities, total } = await activityService.getProjectActivities(
      projectId,
      { page, limit }
    );

    return sendPaginated(res, activities, { page, limit, total });
  } catch (error) {
    next(error);
  }
}

module.exports = { list };
