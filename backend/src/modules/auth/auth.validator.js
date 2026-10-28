/**
 * Auth validation schemas.
 */

const { z } = require('zod');

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters')
    .toLowerCase(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Password is required'),
});

const resetPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  newPassword: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
});

module.exports = { registerSchema, loginSchema, resetPasswordSchema };
