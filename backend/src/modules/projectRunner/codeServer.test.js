/**
 * code-server service unit tests.
 * Tests Docker availability checking, port allocation, and session management.
 */

const codeServerService = require('./codeServer.service');

describe('code-server Service', () => {

  describe('checkStatus', () => {
    it('should return Docker availability status', async () => {
      const status = await codeServerService.checkStatus();
      expect(status).toHaveProperty('available');

      if (status.available) {
        expect(status).toHaveProperty('version');
        expect(typeof status.version).toBe('string');
        expect(status).toHaveProperty('imageReady');
        expect(typeof status.imageReady).toBe('boolean');
        expect(status).toHaveProperty('image');
        expect(status.image).toBe('codercom/code-server:latest');
      } else {
        expect(status).toHaveProperty('error');
      }
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent project', () => {
      const session = codeServerService.getSession('non-existent-project-id');
      expect(session).toBeNull();
    });
  });

  describe('findProjectBySocket', () => {
    it('should return null for non-existent socket', () => {
      const projectId = codeServerService.findProjectBySocket('non-existent-socket-id');
      expect(projectId).toBeNull();
    });
  });

  describe('destroyAll', () => {
    it('should handle destroy with no active sessions', async () => {
      // Should not throw
      await codeServerService.destroyAll();
    });
  });
});


