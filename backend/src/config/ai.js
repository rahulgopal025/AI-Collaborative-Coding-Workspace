/**
 * AI provider configuration.
 * Centralizes model names, token limits, and provider selection.
 */

const AI_PROVIDERS = {
  GEMINI: 'gemini',
  OPENAI: 'openai',
};

const AI_CONFIG = {
  // Default provider to use when none is specified
  defaultProvider: AI_PROVIDERS.GEMINI,

  gemini: {
    model: 'gemini-2.0-flash',
    maxOutputTokens: 4096,
    temperature: 0.7,
  },

  openai: {
    model: 'gpt-4o-mini',
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
