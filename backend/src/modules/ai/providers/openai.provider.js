/**
 * OpenAI provider implementation.
 */

const OpenAI = require('openai');
const { AI_CONFIG } = require('../../../config/ai');
const logger = require('../../../common/utils/logger');
const AppError = require('../../../common/errors/AppError');
const ERROR_CODES = require('../../../common/errors/errorCodes');

let openaiClient = null;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw AppError.badRequest('OpenAI API key is not configured', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function sanitizeErrorMessage(msg) {
  if (!msg) return 'AI provider error';
  return msg
    .replace(/[a-zA-Z0-9_-]{30,}/g, '[REDACTED]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
}

/**
 * Generate content using OpenAI.
 */
async function generate(systemPrompt, userPrompt) {
  try {
    const client = getClient();

    const response = await client.chat.completions.create({
      model: AI_CONFIG.openai.model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
      max_tokens: AI_CONFIG.openai.maxTokens,
      temperature: AI_CONFIG.openai.temperature,
    });

    return response.choices[0].message.content;
  } catch (error) {
    const rawMessage = error.message || '';
    logger.error({ error: sanitizeErrorMessage(rawMessage) }, 'OpenAI provider error');

    if (rawMessage.includes('insufficient_quota') || rawMessage.includes('credits remaining') || rawMessage.includes('429')) {
      throw AppError.internal('OpenAI quota exceeded: You have no credits remaining. Please check your billing or switch to Gemini.', ERROR_CODES.RATE_LIMIT_EXCEEDED);
    }
    if (rawMessage.includes('Incorrect API key') || rawMessage.includes('401')) {
      throw AppError.badRequest('Invalid OpenAI API key. Please check your credentials.', ERROR_CODES.AI_PROVIDER_ERROR);
    }

    throw AppError.internal(`Failed to generate response from OpenAI: ${sanitizeErrorMessage(rawMessage)}`, ERROR_CODES.AI_PROVIDER_ERROR);
  }
}

module.exports = { generate };
