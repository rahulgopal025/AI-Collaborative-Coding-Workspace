/**
 * AI provider configuration.
 * Centralizes model names, token limits, and provider selection.
 */

const AI_PROVIDERS = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
};

const AI_CONFIG = {
  // Default provider to use when none is specified (supports AI_CONFIG or AI_PROVIDER env var)
  defaultProvider: (process.env.AI_CONFIG || process.env.AI_PROVIDER || AI_PROVIDERS.GEMINI).toLowerCase(),

  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    fallbackModels: ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'],
    maxOutputTokens: 4096,
    temperature: 0.7,
  },

  openai: {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.7,
  },

  // Max characters of code to send as context to avoid excessive token usage
  maxCodeContextLength: 10000,

  // Max characters for user prompts
  maxPromptLength: 2000,
};

/**
 * Operation types supported by the AI service.
 * Each maps to a specific system prompt template.
 */
const AI_OPERATIONS = {
  EXPLAIN: 'explain',
  DEBUG: 'debug',
  GENERATE: 'generate',
  REFACTOR: 'refactor',
  DOCUMENT: 'document',
};

module.exports = { AI_PROVIDERS, AI_CONFIG, AI_OPERATIONS };
