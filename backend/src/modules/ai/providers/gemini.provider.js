/**
 * Gemini AI provider implementation.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AI_CONFIG } = require('../../../config/ai');
const logger = require('../../../common/utils/logger');
const AppError = require('../../../common/errors/AppError');
const ERROR_CODES = require('../../../common/errors/errorCodes');

let genAI = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw AppError.badRequest('Gemini API key is not configured', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Clean error message to ensure no API keys or secrets are leaked to clients.
 */
function sanitizeErrorMessage(msg) {
  if (!msg) return 'AI provider error';
  return msg
    .replace(/[a-zA-Z0-9_-]{30,}/g, '[REDACTED]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
}

/**
 * Generate content using Gemini with automatic fallback on overloaded/unavailable models.
 */
async function generate(systemPrompt, userPrompt) {
  const client = getClient();
  const modelsToTry = [
    AI_CONFIG.gemini.model,
    ...(AI_CONFIG.gemini.fallbackModels || []),
  ].filter(Boolean);

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt || undefined,
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: AI_CONFIG.gemini.maxOutputTokens,
          temperature: AI_CONFIG.gemini.temperature,
        },
      });

      const response = await result.response;
      return response.text();
    } catch (error) {
      lastError = error;
      const errMsg = error.message || '';
      logger.warn({ model: modelName, error: sanitizeErrorMessage(errMsg) }, 'Gemini model attempt failed, checking fallback');

      // If error is 404 (model not found/deprecated) or 503 (high demand) or 429, try next model
      const isTransientOrModelError =
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('404') ||
        errMsg.includes('not found') ||
        errMsg.includes('no longer available') ||
        errMsg.includes('Resource has been exhausted');

      if (!isTransientOrModelError) {
        // Auth failure or invalid argument — don't loop through other models
        break;
      }
    }
  }

  const rawMessage = lastError?.message || '';
  logger.error({ error: sanitizeErrorMessage(rawMessage) }, 'Gemini provider failed after trying models');

  if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('API key not valid')) {
    throw AppError.badRequest('Invalid Gemini API credentials. Please check your GEMINI_API_KEY.', ERROR_CODES.AI_PROVIDER_ERROR);
  }
  if (rawMessage.includes('503') || rawMessage.includes('high demand')) {
    throw AppError.internal('The Gemini model is currently overloaded with high demand. Please try again in a few moments.', ERROR_CODES.AI_PROVIDER_ERROR);
  }
  if (rawMessage.includes('Resource has been exhausted') || rawMessage.includes('429')) {
    throw AppError.internal('Gemini rate limit or quota exceeded. Please try again shortly.', ERROR_CODES.RATE_LIMIT_EXCEEDED);
  }

  throw AppError.internal(
    `Failed to generate response from Gemini: ${sanitizeErrorMessage(rawMessage)}`,
    ERROR_CODES.AI_PROVIDER_ERROR
  );
}

module.exports = { generate };
