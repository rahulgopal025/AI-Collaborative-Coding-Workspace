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
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw AppError.internal('OpenAI API key is not configured', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: AI_CONFIG.openai.maxTokens,
      temperature: AI_CONFIG.openai.temperature,
    });

    return response.choices[0].message.content;
  } catch (error) {
    logger.error({ error: error.message }, 'OpenAI provider error');
    throw AppError.internal('Failed to generate response from AI', ERROR_CODES.AI_PROVIDER_ERROR);
  }
}

module.exports = { generate };
