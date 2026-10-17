/**
 * Global error handling middleware.
 * Catches all errors and returns consistent JSON responses.
 * Must be registered LAST in the middleware chain.
 */

const logger = require('../common/utils/logger');
const AppError = require('../common/errors/AppError');
const { sendError } = require('../common/utils/response');

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  // Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';

  // Handle known operational errors (thrown intentionally via AppError)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  }

  // Handle Prisma known request errors (e.g. unique constraint violation)
  if (err.code === 'P2002') {
    statusCode = 409;
    const target = err.meta?.target;
    message = target
      ? `A record with this ${target.join(', ')} already exists`
      : 'A duplicate record already exists';
    code = 'CONFLICT';
  }

  // Handle Prisma not-found errors
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
    code = 'NOT_FOUND';
  }

  // Handle Zod validation errors (in case they escape the validation middleware)
  if (err.name === 'ZodError') {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
  }

  // Log errors
  if (statusCode >= 500) {
    logger.error({ err, url: req.originalUrl, method: req.method }, 'Server error');
  } else {
    logger.warn({ statusCode, code, url: req.originalUrl, method: req.method }, message);
  }

  // Never expose stack traces or internals in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'Internal server error';
  }

  return sendError(res, message, statusCode, code);
}

module.exports = { errorHandler };
