/**
 * Execution controller.
 */

const executionService = require('./execution.service');
const { sendSuccess } = require('../../common/utils/response');

async function getLanguages(req, res, next) {
  try {
    const languages = executionService.getSupportedLanguages();
    return sendSuccess(res, languages);
  } catch (error) {
    next(error);
  }
}

async function run(req, res, next) {
  try {
    const { language, sourceCode, stdin } = req.body;
    
    // In the future, we could log the execution associated with the user/project here
    // e.g. await activityService.log(...)

    const result = await executionService.runCode({ language, sourceCode, stdin });
    
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getLanguages,
  run
};
