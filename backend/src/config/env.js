/**
 * Centralized environment configuration with validation.
 * Loads and validates all environment variables using Zod.
 */

const { z } = require('zod');

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform(Number)
    .pipe(z.number().int().positive()),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z
    .string()
    .min(1, 'JWT_SECRET is required'),

  JWT_EXPIRES_IN: z
    .string()
    .default('7d'),

  FRONTEND_URL: z
    .string()
    .default('http://localhost:3000'),

  GEMINI_API_KEY: z
    .string()
    .default(''),

  OPENAI_API_KEY: z
    .string()
    .default(''),
});

/**
 * Parse and validate environment variables.
 * Throws a clear error message listing all invalid fields on failure.
 */
function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  return result.data;
}

const env = validateEnv();

module.exports = env;
