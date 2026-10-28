/**
 * Member routes.
 * GET    /api/projects/:projectId/members          - List members
 * POST   /api/projects/:projectId/members          - Add member
 * PUT    /api/projects/:projectId/members/:userId   - Update member role
 * DELETE /api/projects/:projectId/members/:userId   - Remove member
 */

const { Router } = require('express');
const memberController = require('./member.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireProjectRole, requireProjectMember } = require('../../middlewares/role.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { addMemberSchema, updateMemberRoleSchema, memberParamsSchema } = require('./member.validator');
const { projectIdParamSchema } = require('../projects/project.validator');

const router = Router({ mergeParams: true }); // mergeParams to access :projectId

router.use(authenticate);

router.get(
  '/',
  validate(projectIdParamSchema, 'params'),
  requireProjectMember,
  memberController.list
);

router.post(
  '/',
  validate(projectIdParamSchema, 'params'),
  requireProjectRole('OWNER'),
  validate(addMemberSchema),
  memberController.add
);

router.put(
  '/:userId',
  validate(memberParamsSchema, 'params'),
  requireProjectRole('OWNER'),
  validate(updateMemberRoleSchema),
  memberController.updateRole
);

router.patch(
  '/:userId',
  validate(memberParamsSchema, 'params'),
  requireProjectRole('OWNER'),
  validate(updateMemberRoleSchema),
  memberController.updateRole
);

router.delete(
  '/:userId',
  validate(memberParamsSchema, 'params'),
  requireProjectRole('OWNER'),
  memberController.remove
);

module.exports = router;
