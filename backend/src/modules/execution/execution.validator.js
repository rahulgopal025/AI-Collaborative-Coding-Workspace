/**
 * Execution validation schemas.
 */

const { z } = require('zod');

const runExecutionSchema = z.object({
  language: z.string().min(1, 'Language is required'),
  sourceCode: z.string().min(1, 'Source code is required').max(50000, 'Source code exceeds maximum length of 50000 characters'),
  stdin: z.string().max(10000, 'Stdin exceeds maximum length of 10000 characters').optional().default(''),
});

module.exports = { runExecutionSchema };
