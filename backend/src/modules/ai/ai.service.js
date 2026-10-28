/**
 * AI service.
 * Handles AI request orchestration and provider abstraction.
 */

const geminiProvider = require('./providers/gemini.provider');
const openaiProvider = require('./providers/openai.provider');
const fileService = require('../files/file.service');
const fileRepository = require('../files/file.repository');
const activityService = require('../activities/activity.service');
const permissionService = require('../permissions/permission.service');
const { AI_PROVIDERS, AI_CONFIG } = require('../../config/ai');
const AppError = require('../../common/errors/AppError');

function getActiveProvider() {
  const envChoice = (process.env.AI_CONFIG || process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (envChoice === AI_PROVIDERS.OPENAI || envChoice === AI_PROVIDERS.GEMINI) {
    return envChoice;
  }
  return AI_CONFIG.defaultProvider || AI_PROVIDERS.GEMINI;
}

async function invokeAIProvider(systemPrompt, userPrompt) {
  const providerType = getActiveProvider();
  let responseText = '';

  if (providerType === AI_PROVIDERS.OPENAI) {
    responseText = await openaiProvider.generate(systemPrompt, userPrompt);
  } else if (providerType === AI_PROVIDERS.GEMINI) {
    responseText = await geminiProvider.generate(systemPrompt, userPrompt);
  } else {
    throw AppError.internal(`Unsupported AI provider: ${providerType}`);
  }

  return { responseText, providerType };
}

async function processRequest(data, userId) {
  const { projectId, fileId, selectedCode, language } = data;
  const promptText = data.userPrompt || data.prompt || data.command;

  if (projectId) {
    await permissionService.can(userId, projectId, 'FILE_READ');
  }

  // Build context
  let contextText = data.fileContent || '';
  let fileName = data.fileName || 'Unknown';

  if (fileId) {
    const file = await fileService.getFileById(fileId, userId);
    fileName = file.name;
    const content = file.content || '';
    if (content.length > AI_CONFIG.maxCodeContextLength) {
      contextText = content.substring(0, AI_CONFIG.maxCodeContextLength) + '\n... (truncated)';
    } else {
      contextText = content;
    }
  }

  const systemPrompt = `You are an expert AI coding assistant integrated into CodeCollabAI, a collaborative IDE.
You are helping a developer with their code.

File Context: ${fileName}
Language: ${language || data.fileLanguage || 'Unknown'}

${
  selectedCode
    ? `The user has highlighted the following code:\n\`\`\`\n${selectedCode}\n\`\`\`\n`
    : contextText
      ? `The current file content is:\n\`\`\`\n${contextText}\n\`\`\`\n`
      : ''
}

Please provide a helpful, concise, and accurate response to the user's request.
Return formatted markdown.`;

  const { responseText, providerType } = await invokeAIProvider(systemPrompt, promptText);

  if (projectId) {
    try {
      await activityService.log({
        projectId,
        userId,
        action: 'AI_ASSISTANCE_USED',
        metadata: { provider: providerType, fileId },
      });
    } catch {}
  }

  return {
    response: responseText,
    reply: responseText,
    thoughts: '',
    summary: '',
    applied: [],
  };
}

async function executeCommand(data, userId) {
  const { projectId, currentFilePath } = data;
  const command = data.command || data.prompt || data.userPrompt;

  if (projectId) {
    await permissionService.can(userId, projectId, 'FILE_READ');
  }

  let fileName = '';
  let contextText = '';
  let language = '';

  if (projectId && currentFilePath) {
    try {
      const files = await fileRepository.findFilesByProjectId(projectId);
      const matched = files.find(f => f.name === currentFilePath || currentFilePath.endsWith(f.name) || (f.path && f.path === currentFilePath));
      if (matched) {
        fileName = matched.name;
        language = matched.language || '';
        const content = matched.content || '';
        if (content.length > AI_CONFIG.maxCodeContextLength) {
          contextText = content.substring(0, AI_CONFIG.maxCodeContextLength) + '\n... (truncated)';
        } else {
          contextText = content;
        }
      }
    } catch {}
  }

  const systemPrompt = `You are an expert AI coding assistant inside CodeCollabAI console.
The user is working in a collaborative code editor.
${fileName ? `Active File: ${fileName}` : ''}
${language ? `Language: ${language}` : ''}
${contextText ? `File Content:\n\`\`\`\n${contextText}\n\`\`\`\n` : ''}

Provide a direct, helpful, and concise response to the user's command or question.
If the user asks a question, answer clearly in markdown.
If the user greets you or says hello, reply warmly and concisely.`;

  const { responseText, providerType } = await invokeAIProvider(systemPrompt, command);

  if (projectId) {
    try {
      await activityService.log({
        projectId,
        userId,
        action: 'AI_ASSISTANCE_USED',
        metadata: { provider: providerType, currentFilePath },
      });
    } catch {}
  }

  return {
    reply: responseText,
    response: responseText,
    thoughts: '',
    summary: '',
    applied: [],
  };
}

module.exports = { processRequest, executeCommand };
