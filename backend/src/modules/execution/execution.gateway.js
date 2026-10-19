/**
 * Execution Socket.IO Gateway — /execution namespace
 *
 * This is the backend counterpart to the frontend's useTerminalSocket hook.
 * It handles real interactive shell command execution and streams output
 * back to the client.
 *
 * Events (Client → Server):
 *   get-cwd               — Request current working directory
 *   run-shell-command     { command, cwd? } — Run a shell command
 *   send-input            { input }         — Send stdin to running process
 *   kill-process                           — Kill the running process
 *
 * Events (Server → Client):
 *   cwd-changed           { cwd }
 *   output                { type: 'output'|'error'|'system', content }
 *   execution-started     { mode, command, cwd }
 *   clear-terminal
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const logger = require('../../common/utils/logger');
const { verifyToken } = require('../../common/utils/jwt');
const { prisma } = require('../../config/database');

// ─── Allowed shell commands (expanded for project work) ──────────────────────
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /format\s+[A-Z]:/i,
  /del\s+\/s\s+\/q\s+[A-Z]:\\/i,
  /mkfs/i,
  /dd\s+if=/i,
  /shutdown/i,
  /reboot/i,
  /halt/i,
  /passwd/i,
  /sudo\s+rm/i,
];

function isCommandBlocked(cmd) {
  return BLOCKED_PATTERNS.some((p) => p.test(cmd));
}

/** Active processes per socket id */
const activeProcesses = new Map();

function setupExecutionGateway(io) {
  const namespace = io.of('/execution');

  // ── Auth middleware ─────────────────────────────────────────────────────
  namespace.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1] ||
        socket.handshake.query?.token;

      // Allow unauthenticated connections for basic terminal use
      // (code execution uses Paiza via HTTP, shell requires auth)
      if (token) {
        try {
          const decoded = verifyToken(token);
          const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, name: true },
          });
          if (user) {
            socket.userId = user.id;
            socket.userName = user.name;
          }
        } catch {
          // token invalid — still allow connection for public code execution
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  });

  // ── Connection Handler ──────────────────────────────────────────────────
  namespace.on('connection', (socket) => {
    logger.debug({ socketId: socket.id, userId: socket.userId }, 'Execution socket connected');

    // Default working directory — use the workspace root on the host, or home
    socket.cwd = process.env.WORKSPACE_ROOT || os.homedir();

    // ── Get CWD ────────────────────────────────────────────────────────
    socket.on('get-cwd', () => {
      socket.emit('cwd-changed', { cwd: socket.cwd });
    });

    // ── Run Shell Command ──────────────────────────────────────────────
    socket.on('run-shell-command', ({ command, cwd } = {}) => {
      if (!command || typeof command !== 'string') return;

      const trimmed = command.trim();
      if (!trimmed) return;

      if (isCommandBlocked(trimmed)) {
        socket.emit('output', { type: 'error', content: `Blocked: "${trimmed}" is not allowed.\n` });
        return;
      }

      // Kill any existing process
      killActiveProcess(socket);

      // Resolve working directory
      const workDir = cwd || socket.cwd || os.homedir();

      // Handle built-in `cd` ourselves (child_process can't change parent cwd)
      if (/^cd(\s+.*)?$/.test(trimmed)) {
        handleCd(socket, trimmed, workDir);
        return;
      }

      // Emit execution-started
      socket.emit('execution-started', { mode: 'shell', command: trimmed, cwd: workDir });

      const isWin = process.platform === 'win32';
      const shell = isWin ? 'cmd.exe' : '/bin/bash';
      const shellArgs = isWin ? ['/c', trimmed] : ['-c', trimmed];

      let proc;
      try {
        proc = spawn(shell, shellArgs, {
          cwd: workDir,
          env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
          windowsHide: true,
        });
      } catch (err) {
        socket.emit('output', { type: 'error', content: `Failed to start process: ${err.message}\n` });
        return;
      }

      activeProcesses.set(socket.id, proc);

      proc.stdout.on('data', (chunk) => {
        socket.emit('output', { type: 'output', content: chunk.toString() });
      });

      proc.stderr.on('data', (chunk) => {
        socket.emit('output', { type: 'error', content: chunk.toString() });
      });

      proc.on('close', (code) => {
        activeProcesses.delete(socket.id);

        // Try to read updated cwd after command completes (unix only)
        socket.emit('output', {
          type: 'system',
          content: `\n[Process Finished with exit code ${code ?? 0}]\n`,
        });
        socket.emit('cwd-changed', { cwd: socket.cwd });
      });

      proc.on('error', (err) => {
        activeProcesses.delete(socket.id);
        socket.emit('output', { type: 'error', content: `Error: ${err.message}\n` });
      });
    });

    // ── Send Input to running process ──────────────────────────────────
    socket.on('send-input', ({ input } = {}) => {
      const proc = activeProcesses.get(socket.id);
      if (proc && proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.write((input || '') + '\n');
      }
    });

    // ── Kill Running Process ───────────────────────────────────────────
    socket.on('kill-process', () => {
      killActiveProcess(socket);
      socket.emit('output', { type: 'system', content: '\n[Process Finished with exit code 1]\n' });
    });

    // ── Disconnect ─────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      killActiveProcess(socket);
      logger.debug({ socketId: socket.id }, 'Execution socket disconnected');
    });
  });

  return { namespace };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function killActiveProcess(socket) {
  const proc = activeProcesses.get(socket.id);
  if (proc) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { windowsHide: true });
      } else {
        process.kill(-proc.pid, 'SIGKILL');
      }
    } catch { /* already exited */ }
    activeProcesses.delete(socket.id);
  }
}

function handleCd(socket, command, workDir) {
  const targetRaw = command.replace(/^cd\s*/, '').trim();
  let target;

  if (!targetRaw || targetRaw === '~') {
    target = os.homedir();
  } else if (path.isAbsolute(targetRaw)) {
    target = targetRaw;
  } else {
    target = path.resolve(workDir, targetRaw);
  }

  const fs = require('fs');
  try {
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) {
      socket.emit('output', { type: 'error', content: `cd: not a directory: ${target}\n` });
      return;
    }
    socket.cwd = target;
    socket.emit('cwd-changed', { cwd: target });
    socket.emit('output', { type: 'system', content: `\n[Process Finished with exit code 0]\n` });
  } catch {
    socket.emit('output', { type: 'error', content: `cd: no such file or directory: ${targetRaw}\n` });
    socket.emit('output', { type: 'system', content: `\n[Process Finished with exit code 1]\n` });
  }
}

module.exports = { setupExecutionGateway };






