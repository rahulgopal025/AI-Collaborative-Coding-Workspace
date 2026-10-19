/**
 * Project Runner command validator.
 * Maintains a strict allowlist of commands that can be executed inside containers.
 * This is a security boundary — only whitelisted commands are permitted.
 */

const AppError = require('../../common/errors/AppError');

/**
 * Allowed command patterns for container execution.
 * Each entry defines:
 *   - pattern: RegExp that the full command must match
 *   - description: Human-readable description for logging/UI
 */
const ALLOWED_COMMANDS = [
  { pattern: /^npm\s+(install|i)(\s+[\w@/.:-]+)*(\s+--[\w-]+(=[\w.-]+)?)*$/, description: 'npm install / i (with packages/flags)' },
  { pattern: /^npm\s+ci(\s+--[\w-]+(=[\w.-]+)?)*$/, description: 'npm ci (clean install)' },
  { pattern: /^npm\s+run\s+[\w:.-]+(\s+--\s+.*)?$/, description: 'npm run <script>' },
  { pattern: /^npm\s+start$/, description: 'npm start' },
  { pattern: /^npm\s+test(\s+--\s+.*)?$/, description: 'npm test' },
  { pattern: /^npm\s+run\s+build$/, description: 'npm run build' },
  { pattern: /^npm\s+run\s+dev$/, description: 'npm run dev' },
  { pattern: /^node\s+[\w/.+-]+\.m?js(\s+.*)?$/, description: 'node <file.js> [args]' },
  { pattern: /^npx\s+[\w@/.:-]+(\s+[\w/.=:-]+)*$/, description: 'npx <package> [args]' },
  { pattern: /^mkdir(\s+-p)?\s+[\w/._-]+$/, description: 'mkdir [-p] <dir>' },
  { pattern: /^touch\s+[\w/._-]+$/, description: 'touch <file>' },
  { pattern: /^cp(\s+-r)?\s+[\w/._-]+\s+[\w/._-]+$/, description: 'cp [-r] <src> <dest>' },
  { pattern: /^mv\s+[\w/._-]+\s+[\w/._-]+$/, description: 'mv <src> <dest>' },
  { pattern: /^ls(\s+-[alrhR]+)*(\s+[\w/.]+)?$/, description: 'ls (list files)' },
  { pattern: /^cat\s+[\w/.+-]+$/, description: 'cat <file>' },
  { pattern: /^pwd$/, description: 'pwd (print working directory)' },
  { pattern: /^python3?\s+[\w/.+-]+\.py(\s+.*)?$/, description: 'python <file.py>' },
];

/**
 * Dangerous patterns that are always blocked, even if they slip through allowlist.
 */
const BLOCKED_PATTERNS = [
  /[;&|`$]/, // Shell metacharacters for chaining/injection
  /\.\.\//,  // Directory traversal
  /\brm\b/,  // rm commands
  /\bsudo\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bcurl\b/,
  /\bwget\b/,
  /\bkill\b/,
  />\s*/,    // Output redirection
  /\beval\b/,
  /\bexec\b/,
];

/**
 * Validate that a command is safe to execute inside a project container.
 * @param {string} command - The raw command string
 * @returns {{ valid: boolean, sanitized: string, description: string }}
 * @throws {AppError} If the command is blocked
 */
function validateCommand(command) {
  if (!command || typeof command !== 'string') {
    throw AppError.badRequest('Command is required', 'RUNNER_INVALID_COMMAND');
  }

  const trimmed = command.trim();

  if (trimmed.length === 0) {
    throw AppError.badRequest('Command cannot be empty', 'RUNNER_INVALID_COMMAND');
  }

  if (trimmed.length > 500) {
    throw AppError.badRequest('Command too long (max 500 characters)', 'RUNNER_INVALID_COMMAND');
  }

  // Check for blocked patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw AppError.forbidden(
        'Command contains forbidden characters or patterns',
        'RUNNER_COMMAND_BLOCKED'
      );
    }
  }

  // Check against allowlist
  for (const allowed of ALLOWED_COMMANDS) {
    if (allowed.pattern.test(trimmed)) {
      return {
        valid: true,
        sanitized: trimmed,
        description: allowed.description,
      };
    }
  }

  throw AppError.forbidden(
    `Command not allowed. Permitted commands: npm install, npm run <script>, npm start, npm test, node <file>, mkdir, touch, cp, mv, ls, cat, pwd`,
    'RUNNER_COMMAND_NOT_ALLOWED'
  );
}

/**
 * Container resource limits.
 */
const CONTAINER_LIMITS = {
  Memory: 512 * 1024 * 1024, // 512MB
  NanoCpus: 1e9,             // 1 CPU core
  PidsLimit: 256,
};

/**
 * Maximum container lifetime in milliseconds (10 minutes).
 */
const MAX_CONTAINER_LIFETIME_MS = 10 * 60 * 1000;

/**
 * Docker image to use for Node.js project containers.
 */
const NODE_DOCKER_IMAGE = 'codercom/code-server:latest';

module.exports = {
  validateCommand,
  ALLOWED_COMMANDS,
  BLOCKED_PATTERNS,
  CONTAINER_LIMITS,
  MAX_CONTAINER_LIFETIME_MS,
  NODE_DOCKER_IMAGE,
};
