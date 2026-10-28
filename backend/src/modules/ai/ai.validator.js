/**
 * AI request validation schema.
 */

const { z } = require('zod');

const aiRequestSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional().nullable(),
  fileId: z.string().uuid('Invalid file ID').optional().nullable(),
  selectedCode: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  userPrompt: z.string().optional().nullable(),
  prompt: z.string().optional().nullable(),
  command: z.string().optional().nullable(),
  currentFilePath: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  fileContent: z.string().optional().nullable(),
  fileLanguage: z.string().optional().nullable(),
  action: z.string().optional().nullable(),
  conversation: z.array(z.any()).optional().nullable(),
}).refine(data => !!(data.userPrompt || data.prompt || data.command), {
  message: 'Prompt or command is required',
  path: ['prompt'],
});

const aiExecuteSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional().nullable(),
  command: z.string().min(1, 'Command is required').max(4000, 'Command is too long'),
  currentFilePath: z.string().optional().nullable(),
});

module.exports = { aiRequestSchema, aiExecuteSchema };
