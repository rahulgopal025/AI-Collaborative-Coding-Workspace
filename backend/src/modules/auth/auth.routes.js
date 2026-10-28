/**
 * Auth routes.
 * POST /api/auth/register - Register a new user
 * POST /api/auth/login    - Login and get JWT
 * GET  /api/auth/me       - Get current user profile
 * POST /api/auth/logout   - Logout
 */

const { Router } = require('express');
const authController = require('./auth.controller');
const { validate } = require('../../middlewares/validation.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authLimiter } = require('../../middlewares/rateLimit.middleware');
const { registerSchema, loginSchema, resetPasswordSchema } = require('./auth.validator');

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
