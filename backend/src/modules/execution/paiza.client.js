/**
 * Paiza.IO API Client for RapidAPI
 */

const axios = require('axios');
const AppError = require('../../common/errors/AppError');
const ERROR_CODES = require('../../common/errors/errorCodes');
const logger = require('../../common/utils/logger');

const PAIZA_API_URL = process.env.PAIZA_API_URL || 'https://paiza-io.p.rapidapi.com';
const PAIZA_API_KEY = process.env.PAIZA_API_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'paiza-io.p.rapidapi.com';

function getHeaders() {
  if (!PAIZA_API_KEY) {
    throw AppError.internal('Paiza API key is not configured', 'EXECUTION_CONFIG_ERROR');
  }
  return {
    'X-RapidAPI-Key': PAIZA_API_KEY,
    'X-RapidAPI-Host': RAPIDAPI_HOST,
    'Content-Type': 'application/json'
  };
}

async function createRunner(language, sourceCode, stdin = '') {
  try {
    const response = await axios.post(
      `${PAIZA_API_URL}/runners/create`,
      {
        language,
        source_code: sourceCode,
        input: stdin,
      },
      { headers: getHeaders() }
    );
    
    if (response.data && response.data.error) {
      throw new Error(response.data.error);
    }

    return response.data; // { id: "...", status: "running" }
  } catch (error) {
    logger.error({ error: error.message, data: error.response?.data }, 'Paiza createRunner failed');
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw AppError.internal('Execution service authentication failed', 'EXECUTION_AUTH_ERROR');
    }
    if (error.response?.status === 429) {
      throw AppError.internal('Execution service rate limit exceeded', 'EXECUTION_RATE_LIMIT');
    }
    throw AppError.internal('Failed to start execution', 'EXECUTION_START_FAILED');
  }
}

async function getRunnerDetails(id) {
  try {
    const response = await axios.get(
      `${PAIZA_API_URL}/runners/get_details`,
      {
        params: { id },
        headers: getHeaders()
      }
    );

    return response.data;
  } catch (error) {
    logger.error({ error: error.message, data: error.response?.data }, 'Paiza getRunnerDetails failed');
    throw AppError.internal('Failed to get execution details', 'EXECUTION_DETAILS_FAILED');
  }
}

module.exports = { createRunner, getRunnerDetails };
