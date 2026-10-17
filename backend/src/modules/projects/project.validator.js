/**
 * Project validation schemas.
 */

const { z } = require('zod');

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be at most 100 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .trim()
    .nullable()
    .optional(),
});

const updateProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be at most 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .trim()
    .nullable()
    .optional(),
});

const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

module.exports = { createProjectSchema, updateProjectSchema, projectIdParamSchema };
