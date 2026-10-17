/**
 * Rate limiting middleware.
 * Provides configurable rate limiters for different endpoint categories.
 */

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter.
 * Allows 100 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Stricter rate limiter for authentication endpoints.
 * Allows 20 requests per 15 minutes per IP to prevent brute-force attacks.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Rate limiter for AI endpoints.
 * Allows 30 requests per 15 minutes per IP to manage AI API costs.
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

module.exports = { apiLimiter, authLimiter, aiLimiter };
