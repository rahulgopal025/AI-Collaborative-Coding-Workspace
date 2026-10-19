/**
 * File Materializer.
 * Exports project files and folders from the database (Prisma) to a
 * temporary directory on disk so they can be bind-mounted into Docker containers.
 *
 * Also provides utilities to detect newly created files after container execution.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { prisma } = require('../../config/database');
const logger = require('../../common/utils/logger');

/**
 * Materialize all files and folders for a project onto disk.
 *
 * Layout:
 *   <tempDir>/
 *     <projectId>/
 *       folder1/
 *         file1.js
 *       file2.js
 *       ...
 *
 * @param {string} projectId
 * @returns {Promise<{ projectDir: string, fileCount: number }>}
 */
async function materialize(projectId) {
  // Fetch all folders and files for the project in parallel
  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { projectId },
      select: { id: true, name: true, parentId: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.file.findMany({
      where: { projectId },
      select: { id: true, name: true, content: true, folderId: true },
    }),
  ]);

  // Create a temp directory for this project
  const baseDir = path.join(os.tmpdir(), 'codecollab-runner');
  const projectDir = path.join(baseDir, projectId);

  // Ensure project directory exists without wiping node_modules or dependencies
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Build folder ID → full path map
  const folderPaths = buildFolderPaths(folders, projectDir);

  // Create all folders on disk
  for (const folderPath of Object.values(folderPaths)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Write all files to disk
  let fileCount = 0;
  for (const file of files) {
    const parentPath = file.folderId ? folderPaths[file.folderId] : projectDir;
    if (!parentPath) {
      logger.warn({ fileId: file.id, folderId: file.folderId }, 'Skipping file with unknown parent folder');
      continue;
    }

    const filePath = path.join(parentPath, file.name);
    fs.writeFileSync(filePath, file.content || '', 'utf-8');
    fileCount++;
  }

  logger.info(
    { projectId, projectDir, fileCount, folderCount: folders.length },
    'Project files materialized to disk'
  );

  return { projectDir, fileCount };
}

/**
 * Build a map of folder ID → absolute filesystem path.
 * Handles nested folders via recursive parent resolution.
 *
 * @param {Array<{id: string, name: string, parentId: string|null}>} folders
 * @param {string} rootDir
 * @returns {Record<string, string>}
 */
function buildFolderPaths(folders, rootDir) {
  const folderMap = {};
  const pathCache = {};

  // Index folders by ID
  for (const folder of folders) {
    folderMap[folder.id] = folder;
  }

  function resolvePath(folderId) {
    if (pathCache[folderId]) return pathCache[folderId];

    const folder = folderMap[folderId];
    if (!folder) return rootDir;

    const parentPath = folder.parentId
      ? resolvePath(folder.parentId)
      : rootDir;

    const fullPath = path.join(parentPath, folder.name);
    pathCache[folderId] = fullPath;
    return fullPath;
  }

  for (const folder of folders) {
    resolvePath(folder.id);
  }

  return pathCache;
}

/**
 * Scan the project directory for files that were created during container execution
 * (e.g., node_modules artifacts, build output, lock files).
 * Returns a list of relative paths of new/changed files.
 *
 * @param {string} projectDir
 * @param {Set<string>} originalFiles - Set of relative paths that existed before execution
 * @returns {string[]} List of new relative file paths
 */
function detectNewFiles(projectDir, originalFiles) {
  const newFiles = [];

  function walk(dir, prefix = '') {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      // Skip node_modules — too many files, not useful to sync back
      if (entry.name === 'node_modules' || entry.name === '.git') continue;

      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), relativePath);
      } else if (!originalFiles.has(relativePath)) {
        newFiles.push(relativePath);
      }
    }
  }

  walk(projectDir);
  return newFiles;
}

/**
 * Get the set of all relative file paths in a directory.
 *
 * @param {string} projectDir
 * @returns {Set<string>}
 */
function snapshotFileList(projectDir) {
  const files = new Set();

  function walk(dir, prefix = '') {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;

      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), relativePath);
      } else {
        files.add(relativePath);
      }
    }
  }

  walk(projectDir);
  return files;
}

/**
 * Clean up the materialized project directory.
 *
 * @param {string} projectDir
 */
function cleanup(projectDir) {
  try {
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
      logger.debug({ projectDir }, 'Cleaned up materialized project directory');
    }
  } catch (err) {
    logger.warn({ projectDir, error: err.message }, 'Failed to clean up project directory');
  }
}

/**
 * Get the materialized directory path for a project.
 * @param {string} projectId
 * @returns {string}
 */
function getProjectDir(projectId) {
  const baseDir = path.join(os.tmpdir(), 'codecollab-runner');
  return path.join(baseDir, projectId);
}

/** Tracking files written from editor to disk to prevent watcher echo loops */
const recentlyWrittenToDisk = new Map();

/**
 * Synchronize a file saved in the editor/database to the runtime disk directory.
 *
 * @param {string} projectId
 * @param {string} relativePath - Relative path inside project (e.g., 'src/App.tsx')
 * @param {string} content - File text content
 */
function syncFileToDisk(projectId, relativePath, content) {
  const projectDir = getProjectDir(projectId);
  if (!fs.existsSync(projectDir)) return;

  const normalized = relativePath.replace(/^[/\\]+/, '');
  const fullPath = path.join(projectDir, normalized);

  try {
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    recentlyWrittenToDisk.set(fullPath, Date.now());
    fs.writeFileSync(fullPath, content || '', 'utf-8');
    logger.debug({ projectId, fullPath }, 'Synced file from editor to runtime disk');
  } catch (err) {
    logger.warn({ projectId, fullPath, error: err.message }, 'Failed to sync file to runtime disk');
  }
}

/** Active filesystem watchers, keyed by projectId */
const activeWatchers = new Map();

/**
 * Start watching the materialized project directory for changes made inside the container
 * (e.g., from code-server, terminal commands, build tools).
 *
 * Changes are synchronized back to Prisma and broadcast to connected collaborators.
 *
 * @param {string} projectId
 * @param {import('socket.io').Server} [io] - Socket.IO server for notifications
 */
function startWatcher(projectId, io) {
  stopWatcher(projectId);

  const projectDir = getProjectDir(projectId);
  if (!fs.existsSync(projectDir)) return;

  let debounceTimer = null;
  const pendingChanges = new Set();

  try {
    const watcher = fs.watch(projectDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      // Normalize path separators
      const normalized = filename.replace(/\\/g, '/');

      // Handle node_modules creation/removal event without syncing package files
      if (normalized.includes('node_modules')) {
        const hasNodeModules = fs.existsSync(path.join(projectDir, 'node_modules'));
        if (io) {
          io.of('/project-runner').to(`project:${projectId}`).emit('runner:node-modules-status', {
            projectId,
            hasNodeModules,
          });
        }
        return;
      }

      // Ignore noise directories and files
      if (
        normalized.includes('.git/') ||
        normalized.includes('.git\\') ||
        normalized === '.git' ||
        normalized.includes('dist/') ||
        normalized.includes('.next/') ||
        normalized.includes('.cache/') ||
        normalized.endsWith('.tmp')
      ) {
        return;
      }

      const fullPath = path.join(projectDir, filename);

      // Check if this was written by our own editor sync (echo loop prevention)
      const lastWritten = recentlyWrittenToDisk.get(fullPath);
      if (lastWritten && Date.now() - lastWritten < 1500) {
        return;
      }

      pendingChanges.add(filename);

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const filesToProcess = Array.from(pendingChanges);
        pendingChanges.clear();

        for (const fileRel of filesToProcess) {
          await syncDiskChangeToDb(projectId, projectDir, fileRel);
        }

        // Notify project collaborators that files changed on disk
        if (io) {
          io.of('/project-runner').to(`project:${projectId}`).emit('runner:files-synced', {
            projectId,
            files: filesToProcess,
          });
          io.to(`project:${projectId}`).emit('files:refetch');
        }
      }, 300);
    });

    activeWatchers.set(projectId, watcher);
    logger.info({ projectId, projectDir }, 'Filesystem watcher started for project');
  } catch (err) {
    logger.warn({ projectId, error: err.message }, 'Failed to start filesystem watcher');
  }
}

/**
 * Synchronize a changed file from disk into the database (Prisma).
 *
 * @param {string} projectId
 * @param {string} projectDir
 * @param {string} relativePath
 */
async function syncDiskChangeToDb(projectId, projectDir, relativePath) {
  const fullPath = path.join(projectDir, relativePath);

  try {
    if (!fs.existsSync(fullPath)) {
      // File was deleted
      const fileName = path.basename(relativePath);
      await prisma.file.deleteMany({
        where: { projectId, name: fileName },
      });
      return;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Create folder if needed
      const folderName = path.basename(relativePath);
      const existing = await prisma.folder.findFirst({
        where: { projectId, name: folderName },
      });
      if (!existing) {
        await prisma.folder.create({
          data: { projectId, name: folderName },
        });
      }
      return;
    }

    // It's a file: read content and upsert to DB
    const content = fs.readFileSync(fullPath, 'utf-8');
    const fileName = path.basename(relativePath);

    // Find if folder exists for parent
    const parentDirName = path.dirname(relativePath);
    let folderId = null;
    if (parentDirName && parentDirName !== '.') {
      const parentName = path.basename(parentDirName);
      let folder = await prisma.folder.findFirst({
        where: { projectId, name: parentName },
      });
      if (!folder) {
        folder = await prisma.folder.create({
          data: { projectId, name: parentName },
        });
      }
      folderId = folder.id;
    }

    // Upsert the file in the database
    const existingFile = await prisma.file.findFirst({
      where: { projectId, name: fileName, folderId },
    });

    if (existingFile) {
      await prisma.file.update({
        where: { id: existingFile.id },
        data: { content, updatedAt: new Date() },
      });
    } else {
      await prisma.file.create({
        data: {
          projectId,
          name: fileName,
          folderId,
          content,
        },
      });
    }
  } catch (err) {
    logger.warn({ projectId, relativePath, error: err.message }, 'Failed to sync disk change to DB');
  }
}

/**
 * Stop watching a project's filesystem.
 *
 * @param {string} projectId
 */
function stopWatcher(projectId) {
  const watcher = activeWatchers.get(projectId);
  if (watcher) {
    try {
      watcher.close();
      activeWatchers.delete(projectId);
      logger.debug({ projectId }, 'Filesystem watcher stopped');
    } catch (err) {
      logger.warn({ projectId, error: err.message }, 'Error closing filesystem watcher');
    }
  }
}

module.exports = {
  materialize,
  buildFolderPaths,
  detectNewFiles,
  snapshotFileList,
  cleanup,
  getProjectDir,
  syncFileToDisk,
  startWatcher,
  stopWatcher,
};
