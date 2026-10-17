/**
 * Custom application error class.
 * Extends Error with HTTP status code and an application-specific error code.
 * Used by the error middleware to produce consistent JSON error responses.
 */

class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} statusCode - HTTP status code (e.g. 400, 401, 404, 500)
   * @param {string} code - Application error code (e.g. 'AUTH_INVALID_CREDENTIALS')
   */
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Distinguishes expected errors from programming bugs

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Factory for 400 Bad Request errors.
   */
  static badRequest(message, code = 'BAD_REQUEST') {
    return new AppError(message, 400, code);
  }

  /**
   * Factory for 401 Unauthorized errors.
   */
  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  /**
   * Factory for 403 Forbidden errors.
   */
  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }

  /**
   * Factory for 404 Not Found errors.
   */
  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }

  /**
   * Factory for 409 Conflict errors.
   */
  static conflict(message, code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }

  /**
   * Factory for 429 Too Many Requests errors.
   */
  static tooManyRequests(message = 'Too many requests', code = 'RATE_LIMIT_EXCEEDED') {
    return new AppError(message, 429, code);
  }

  /**
   * Factory for 500 Internal Server Error.
   */
  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    return new AppError(message, 500, code);
  }
}

module.exports = AppError;
