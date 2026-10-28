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
    const { language, sourceCode, stdin, projectId } = req.body;
    
    if (projectId) {
      const permissionService = require('../permissions/permission.service');
      await permissionService.can(req.user.id, projectId, 'EXECUTE_CODE');
    }

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
