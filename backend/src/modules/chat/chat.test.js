const chatService = require('./chat.service');
const chatRepository = require('./chat.repository');
const permissionService = require('../permissions/permission.service');
const presenceService = require('../collaboration/presence.service');

jest.mock('./chat.repository');
jest.mock('../permissions/permission.service');
jest.mock('../activities/activity.service', () => ({
  log: jest.fn().mockResolvedValue({}),
}));

describe('Chat Service & Presence Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should create and return message with author information', async () => {
      const projectId = 'proj-123';
      const userId = 'user-456';
      const content = 'Hello team!';

      permissionService.can.mockResolvedValue(true);
      const mockCreated = {
        id: 'msg-1',
        content,
        userId,
        projectId,
        createdAt: new Date(),
        user: { id: userId, name: 'Alice Smith', email: 'alice@example.com', avatarUrl: null },
      };
      chatRepository.create.mockResolvedValue(mockCreated);

      const result = await chatService.sendMessage(projectId, userId, content);

      expect(permissionService.can).toHaveBeenCalledWith(userId, projectId, 'CHAT_SEND');
      expect(chatRepository.create).toHaveBeenCalledWith({
        projectId,
        userId,
        content: 'Hello team!',
      });
      expect(result.user.name).toBe('Alice Smith');
    });

    it('should reject empty message', async () => {
      permissionService.can.mockResolvedValue(true);
      await expect(chatService.sendMessage('proj-1', 'user-1', '   ')).rejects.toThrow(
        'Message cannot be empty'
      );
    });
  });

  describe('getProjectMessages', () => {
    it('should fetch messages ordered chronologically', async () => {
      permissionService.can.mockResolvedValue(true);
      const mockResult = {
        messages: [
          { id: '1', content: 'First', createdAt: new Date('2026-10-24T10:00:00Z') },
          { id: '2', content: 'Second', createdAt: new Date('2026-10-24T10:01:00Z') },
        ],
        total: 2,
      };
      chatRepository.findByProjectId.mockResolvedValue(mockResult);

      const result = await chatService.getProjectMessages('proj-1', 'user-1', { page: 1, limit: 50 });
      expect(permissionService.can).toHaveBeenCalledWith('user-1', 'proj-1', 'FILE_READ');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toBe('First');
    });
  });

  describe('Presence Tracking', () => {
    it('should track user name and avatar without duplicates per socket', () => {
      presenceService.trackConnection('socket-1', 'user-1', 'Alice Developer', 'https://avatar.com/1');
      presenceService.trackConnection('socket-2', 'user-1', 'Alice Developer', 'https://avatar.com/1');
      presenceService.updatePresence('socket-1', { projectId: 'proj-1' });
      presenceService.updatePresence('socket-2', { projectId: 'proj-1' });

      const presence = presenceService.getProjectPresence('proj-1');
      expect(presence).toHaveLength(2);
      expect(presence[0].name).toBe('Alice Developer');

      const userConns = presenceService.getUserConnectionsInProject('proj-1', 'user-1');
      expect(userConns).toHaveLength(2);

      presenceService.removeConnection('socket-1');
      const remaining = presenceService.getUserConnectionsInProject('proj-1', 'user-1');
      expect(remaining).toHaveLength(1);
      expect(remaining[0]).toBe('socket-2');

      presenceService.removeConnection('socket-2');
    });
  });
});
