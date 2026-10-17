/**
 * Auth validation schemas.
 */

const { z } = require('zod');

const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters')
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
});

const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Password is required'),
});

module.exports = { registerSchema, loginSchema };
