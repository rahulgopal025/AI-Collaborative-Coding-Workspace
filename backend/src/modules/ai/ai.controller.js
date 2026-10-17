/**
 * AI controller.
 */

const aiService = require('./ai.service');
const { sendSuccess } = require('../../common/utils/response');

async function processRequest(req, res, next) {
  try {
    const result = await aiService.processRequest(req.body, req.user.id);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

module.exports = { processRequest };
