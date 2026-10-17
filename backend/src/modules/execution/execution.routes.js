/**
 * Execution routes.
 * GET  /api/execution/languages - Get supported languages
 * POST /api/execution/run       - Execute code
 */

const { Router } = require('express');
const executionController = require('./execution.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { runExecutionSchema } = require('./execution.validator');
const rateLimit = require('express-rate-limit');

const router = Router();

// Define a specific rate limiter for code execution
// For example: max 10 executions per minute per IP
const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: {
      message: 'Execution rate limit exceeded, please try again later.',
      code: 'EXECUTION_RATE_LIMIT'
    }
  }
});

// All execution routes require authentication
router.use(authenticate);

router.get('/languages', executionController.getLanguages);

router.post(
  '/run',
  executionLimiter,
  validate(runExecutionSchema),
  executionController.run
);

module.exports = router;
