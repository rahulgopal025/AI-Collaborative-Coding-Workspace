/**
 * Activity routes.
 * GET /api/projects/:projectId/activities - List project activities
 */

const { Router } = require('express');
const activityController = require('./activity.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireProjectMember } = require('../../middlewares/role.middleware');

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', requireProjectMember, activityController.list);

module.exports = router;
