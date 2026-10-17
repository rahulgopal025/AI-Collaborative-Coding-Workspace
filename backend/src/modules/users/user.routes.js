/**
 * User routes.
 * GET /api/users/me  - Get current user profile
 * PUT /api/users/me  - Update current user profile
 * GET /api/users/:id - Get a user by ID
 */

const { Router } = require('express');
const userController = require('./user.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { updateProfileSchema, userIdParamSchema } = require('./user.validator');

const router = Router();

// All user routes require authentication
router.use(authenticate);

router.get('/me', userController.getMe);
router.put('/me', validate(updateProfileSchema), userController.updateMe);
router.get('/:id', validate(userIdParamSchema, 'params'), userController.getUserById);

module.exports = router;
