/**
 * Standardized API response helpers.
 * Ensures all endpoints return a consistent JSON shape.
 */

/**
 * Send a success response.
 * @param {import('express').Response} res - Express response object
 * @param {*} data - Response payload
 * @param {number} [statusCode=200] - HTTP status code
 */
function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Send a paginated success response.
 * @param {import('express').Response} res - Express response object
 * @param {Array} data - Array of items for the current page
 * @param {{ page: number, limit: number, total: number }} pagination - Pagination metadata
 */
function sendPaginated(res, data, pagination) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}

/**
 * Send an error response.
 * @param {import('express').Response} res - Express response object
 * @param {string} message - Error message
 * @param {number} [statusCode=500] - HTTP status code
 * @param {string} [code='INTERNAL_ERROR'] - Application error code
 */
function sendError(res, message, statusCode = 500, code = 'INTERNAL_ERROR') {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}

module.exports = { sendSuccess, sendPaginated, sendError };
