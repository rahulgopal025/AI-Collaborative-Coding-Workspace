/**
 * Structured logger using Pino.
 * Uses pino-pretty for human-readable output in development.
 */

const pino = require('pino');

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Use pino-pretty for readable logs in development
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Avoid logging sensitive fields
  redact: {
    paths: ['password', 'token', 'authorization', 'cookie'],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
