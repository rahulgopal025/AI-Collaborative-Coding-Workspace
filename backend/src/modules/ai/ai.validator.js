/**
 * AI request validation schema.
 */

const { z } = require('zod');
const { AI_OPERATIONS } = require('../../config/ai');

const aiRequestSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  fileId: z.string().uuid('Invalid file ID').optional().nullable(),
  selectedCode: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  userPrompt: z.string().min(1, 'Prompt is required').max(2000, 'Prompt is too long'),
});

module.exports = { aiRequestSchema };
