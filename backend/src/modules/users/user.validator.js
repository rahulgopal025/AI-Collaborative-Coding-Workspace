/**
 * User validation schemas.
 */

const { z } = require('zod');

const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim()
    .optional(),
  avatarUrl: z
    .string()
    .url('Invalid avatar URL')
    .max(500)
    .nullable()
    .optional(),
});

const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

module.exports = { updateProfileSchema, userIdParamSchema };
