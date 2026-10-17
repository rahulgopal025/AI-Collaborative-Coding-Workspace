/**
 * Chat routes.
 * GET /api/projects/:projectId/messages - Get chat history (paginated)
 */

const { Router } = require('express');
const chatController = require('./chat.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', chatController.list);
router.delete('/:messageId', chatController.remove);

module.exports = router;
