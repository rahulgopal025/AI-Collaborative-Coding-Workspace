/**
 * User controller.
 */

const userService = require('./user.service');
const { sendSuccess } = require('../../common/utils/response');

async function getMe(req, res, next) {
  try {
    const user = await userService.getProfile(req.user.id);
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

async function updateMe(req, res, next) {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

module.exports = { getMe, updateMe, getUserById };
