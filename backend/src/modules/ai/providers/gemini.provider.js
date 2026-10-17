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
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw AppError.internal('Gemini API key is not configured', ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Generate content using Gemini.
 */
async function generate(systemPrompt, userPrompt) {
  try {
    const client = getClient();
    const model = client.getGenerativeModel({
      model: AI_CONFIG.gemini.model,
      systemInstruction: systemPrompt,
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
    logger.error({ error: error.message }, 'Gemini provider error');
    throw AppError.internal('Failed to generate response from AI', ERROR_CODES.AI_PROVIDER_ERROR);
  }
}

module.exports = { generate };
