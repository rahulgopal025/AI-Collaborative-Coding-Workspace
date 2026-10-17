/**
 * Chat controller.
 */

const chatService = require('./chat.service');
const { sendPaginated } = require('../../common/utils/response');

async function list(req, res, next) {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const { messages, total } = await chatService.getProjectMessages(
      projectId,
      req.user.id,
      { page, limit }
    );

    return sendPaginated(res, messages, { page, limit, total });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const { projectId, messageId } = req.params;
    await chatService.deleteMessage(messageId, req.user.id, projectId);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { list, remove };
