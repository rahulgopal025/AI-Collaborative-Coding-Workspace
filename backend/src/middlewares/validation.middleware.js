/**
 * Request validation middleware using Zod.
 * Validates request body, params, or query against a Zod schema.
 */

const AppError = require('../common/errors/AppError');
const ERROR_CODES = require('../common/errors/errorCodes');

/**
 * Create validation middleware for a specific request source.
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'params' | 'query'} source - Which part of the request to validate
 * @returns {Function} Express middleware
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      const error = AppError.badRequest('Validation failed', ERROR_CODES.VALIDATION_ERROR);
      error.errors = errors;

      return next(error);
    }

    // Replace with parsed/transformed data
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
