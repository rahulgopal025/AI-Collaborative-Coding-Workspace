/**
 * Execution service.
 */

const paizaClient = require('./paiza.client');
const { getSupportedLanguages, normalizeLanguage } = require('./execution.languages');
const AppError = require('../../common/errors/AppError');
const ERROR_CODES = require('../../common/errors/errorCodes');

const MAX_POLLING_ATTEMPTS = 15;
const POLLING_INTERVAL_MS = 1000;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runCode({ language, sourceCode, stdin = '' }) {
  const normalizedLang = normalizeLanguage(language);
  if (!normalizedLang) {
    throw AppError.badRequest(`Unsupported language: ${language}`, ERROR_CODES.VALIDATION_ERROR);
  }

  // 1. Create runner session
  const createResult = await paizaClient.createRunner(normalizedLang, sourceCode, stdin);
  const runnerId = createResult.id;

  if (!runnerId) {
    throw AppError.internal('Failed to retrieve execution session ID from provider', 'EXECUTION_START_FAILED');
  }

  // 2. Poll for completion
  let attempts = 0;
  let details = null;

  while (attempts < MAX_POLLING_ATTEMPTS) {
    details = await paizaClient.getRunnerDetails(runnerId);
    if (details.status === 'completed') {
      break;
    }
    attempts++;
    await delay(POLLING_INTERVAL_MS);
  }

  if (details?.status !== 'completed') {
    throw AppError.internal('Execution timed out', 'EXECUTION_TIMEOUT');
  }

  // 3. Normalize result
  return {
    id: runnerId,
    language: normalizedLang,
    status: details.status, // "completed"
    result: details.result, // "success", "failure", "timeout"
    stdout: details.stdout || '',
    stderr: details.stderr || '',
    buildStdout: details.build_stdout || '',
    buildStderr: details.build_stderr || '',
    buildResult: details.build_result || 'success',
    buildExitCode: details.build_exit_code || 0,
    time: details.time || '0.00',
    memory: details.memory || 0,
    connections: details.connections || 0,
  };
}

module.exports = {
  runCode,
  getSupportedLanguages
};
