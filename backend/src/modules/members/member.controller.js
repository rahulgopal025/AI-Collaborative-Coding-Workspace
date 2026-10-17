/**
 * Member controller.
 */

const memberService = require('./member.service');
const { sendSuccess } = require('../../common/utils/response');

async function list(req, res, next) {
  try {
    const members = await memberService.getProjectMembers(req.params.projectId);
    return sendSuccess(res, members);
  } catch (error) {
    next(error);
  }
}

async function add(req, res, next) {
  try {
    const member = await memberService.addMember(
      req.params.projectId,
      req.body,
      req.user.id
    );
    return sendSuccess(res, member, 201);
  } catch (error) {
    next(error);
  }
}

async function updateRole(req, res, next) {
  try {
    const member = await memberService.updateMemberRole(
      req.params.projectId,
      req.params.userId,
      req.body.role,
      req.user.id
    );
    return sendSuccess(res, member);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await memberService.removeMember(
      req.params.projectId,
      req.params.userId,
      req.user.id
    );
    return sendSuccess(res, { message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, add, updateRole, remove };
