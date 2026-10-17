/**
 * AI service.
 * Handles AI request orchestration and provider abstraction.
 */

const geminiProvider = require('./providers/gemini.provider');
const openaiProvider = require('./providers/openai.provider');
const fileService = require('../files/file.service');
const activityService = require('../activities/activity.service');
const { AI_PROVIDERS, AI_CONFIG } = require('../../config/ai');
const AppError = require('../../common/errors/AppError');

async function processRequest(data, userId) {
  const { projectId, fileId, selectedCode, language, userPrompt } = data;

  // Build context
  let contextText = '';
  let fileName = 'Unknown';

  if (fileId) {
    const file = await fileService.getFileById(fileId, userId);
    fileName = file.name;

    // Constrain context size to prevent token limits
    const content = file.content || '';
    if (content.length > AI_CONFIG.maxCodeContextLength) {
      contextText = content.substring(0, AI_CONFIG.maxCodeContextLength) + '\n... (truncated)';
    } else {
      contextText = content;
    }
  }

  // Construct system prompt
  const systemPrompt = `
You are an expert AI coding assistant integrated into a collaborative code editor.
You are helping a developer with their code.

File Context: ${fileName}
Language: ${language || 'Unknown'}

${
  selectedCode
    ? `The user has highlighted the following code:\n\`\`\`\n${selectedCode}\n\`\`\`\n`
    : `The current full file content is:\n\`\`\`\n${contextText}\n\`\`\`\n`
}

Please provide a helpful, concise, and accurate response to the user's request based on this context.
Return ONLY markdown formatted text. Do not return JSON.
`;

  // Select provider based on configuration (failover to secondary if primary is missing could be implemented here)
  const providerType = AI_CONFIG.defaultProvider;
  let responseText = '';

  if (providerType === AI_PROVIDERS.GEMINI) {
    responseText = await geminiProvider.generate(systemPrompt, userPrompt);
  } else if (providerType === AI_PROVIDERS.OPENAI) {
    responseText = await openaiProvider.generate(systemPrompt, userPrompt);
  } else {
    throw AppError.internal('Invalid AI provider configuration');
  }

  // Log activity
  await activityService.log({
    projectId,
    userId,
    action: 'AI_ASSISTANCE_USED',
    metadata: { provider: providerType, fileId },
  });

  return { response: responseText };
}

module.exports = { processRequest };
