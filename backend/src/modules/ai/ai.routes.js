/**
 * AI routes.
 * POST /api/ai/ask - Ask the AI assistant a question about code
 */

const { Router } = require('express');
const aiController = require('./ai.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validation.middleware');
const { aiRequestSchema } = require('./ai.validator');

const router = Router();

router.use(authenticate);

router.post('/ask', validate(aiRequestSchema), aiController.processRequest);

module.exports = router;
