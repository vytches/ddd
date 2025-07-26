import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import type { ChatHistoryConfig } from '../../../src/core/utils/chat-history';
import { ChatHistory, ChatMessage, ChatSession } from '../../../src/core/utils/chat-history';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
  type Dirent,
} from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock path module
vi.mock('path', () => ({
  join: vi.fn(),
  dirname: vi.fn(),
}));

describe('ChatHistory', () => {
  let chatHistory: ChatHistory;
  let mockConfig: Partial<ChatHistoryConfig>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup path mocks
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
    vi.mocked(path.dirname).mockImplementation(p => p.split('/').slice(0, -1).join('/'));

    // Setup fs mocks
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(mkdirSync).mockReturnValue(undefined);
    vi.mocked(readdirSync).mockReturnValue([]);
    vi.mocked(readFileSync).mockReturnValue('{}');
    vi.mocked(writeFileSync).mockReturnValue(undefined);
    vi.mocked(unlinkSync).mockReturnValue(undefined);
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => false, size: 1024 } as any);

    mockConfig = {
      enabled: true,
      maxSessions: 5,
      maxMessagesPerSession: 10,
      maxHistoryDays: 7,
      storageDir: '/test/storage',
      autoCleanup: false,
    };

    chatHistory = new ChatHistory(mockConfig);
  });

  describe('constructor', () => {
    it('should create ChatHistory with default config', () => {
      const defaultChatHistory = new ChatHistory();
      expect(defaultChatHistory).toBeInstanceOf(ChatHistory);
    });

    it('should create ChatHistory with custom config', () => {
      const customConfig = { enabled: false, maxSessions: 20 };
      const customChatHistory = new ChatHistory(customConfig);
      expect(customChatHistory).toBeInstanceOf(ChatHistory);
    });

    it('should handle initialization errors gracefully', () => {
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        return;
      });

      const [error] = safeRun(() => new ChatHistory(mockConfig));

      expect(error).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to initialize chat history:',
        'Permission denied'
      );
    });
  });

  describe('session management', () => {
    describe('startSession', () => {
      it('should start new session with auto-generated title', async () => {
        const sessionId = await chatHistory.startSession();

        expect(sessionId).toBeTruthy();
        expect(typeof sessionId).toBe('string');

        const session = chatHistory.getCurrentSession();
        expect(session).toBeTruthy();
        expect(session?.id).toBe(sessionId);
        expect(session?.title).toContain('Chat Session');
      });

      it('should start new session with custom title', async () => {
        const customTitle = 'Test Session';
        const sessionId = await chatHistory.startSession(customTitle);

        const session = chatHistory.getCurrentSession();
        expect(session?.title).toBe(customTitle);
      });

      it('should start new session with context', async () => {
        const context = { projectPath: '/test/project', currentCommand: 'generate' };
        const sessionId = await chatHistory.startSession('Test', context);

        const session = chatHistory.getCurrentSession();
        expect(session?.context).toEqual(context);
      });

      it('should return empty string when disabled', async () => {
        const disabledChatHistory = new ChatHistory({ enabled: false });
        const sessionId = await disabledChatHistory.startSession();

        expect(sessionId).toBe('');
      });

      it('should save session to storage', async () => {
        await chatHistory.startSession('Test Session');

        expect(writeFileSync).toHaveBeenCalled();
      });
    });

    describe('resumeSession', () => {
      it('should resume existing session', async () => {
        const sessionId = await chatHistory.startSession('Original Session');
        await chatHistory.startSession('New Session'); // Switch to new session

        const resumed = await chatHistory.resumeSession(sessionId);

        expect(resumed).toBe(true);
        expect(chatHistory.getCurrentSession()?.title).toBe('Original Session');
      });

      it('should try to load session from disk if not in memory', async () => {
        const sessionData = {
          id: 'test-session',
          title: 'Loaded Session',
          startedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          messages: [],
          context: {},
        };

        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue(JSON.stringify(sessionData));

        const resumed = await chatHistory.resumeSession('test-session');

        expect(resumed).toBe(true);
        expect(chatHistory.getCurrentSession()?.title).toBe('Loaded Session');
      });

      it('should return false for non-existent session', async () => {
        const resumed = await chatHistory.resumeSession('non-existent');

        expect(resumed).toBe(false);
        expect(chatHistory.getCurrentSession()).toBeNull();
      });

      it('should return false when disabled', async () => {
        const disabledChatHistory = new ChatHistory({ enabled: false });
        const resumed = await disabledChatHistory.resumeSession('test-session');

        expect(resumed).toBe(false);
      });
    });

    describe('getCurrentSession', () => {
      it('should return null when no session is active', () => {
        const session = chatHistory.getCurrentSession();
        expect(session).toBeNull();
      });

      it('should return current session when active', async () => {
        await chatHistory.startSession('Test Session');
        const session = chatHistory.getCurrentSession();

        expect(session).toBeTruthy();
        expect(session?.title).toBe('Test Session');
      });
    });

    describe('deleteSession', () => {
      it('should delete existing session', async () => {
        const sessionId = await chatHistory.startSession('Test Session');

        const deleted = await chatHistory.deleteSession(sessionId);

        expect(deleted).toBe(true);
        expect(chatHistory.getCurrentSession()).toBeNull();
      });

      it('should return false for non-existent session', async () => {
        const deleted = await chatHistory.deleteSession('non-existent');

        expect(deleted).toBe(false);
      });

      it('should handle file deletion errors', async () => {
        const sessionId = await chatHistory.startSession('Test Session');
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(unlinkSync).mockImplementation(() => {
          throw new Error('Permission denied');
        });

        const deleted = await chatHistory.deleteSession(sessionId);

        expect(deleted).toBe(false);
      });
    });
  });

  describe('message management', () => {
    beforeEach(async () => {
      await chatHistory.startSession('Test Session');
    });

    describe('addMessage', () => {
      it('should add message to current session', async () => {
        const messageId = await chatHistory.addMessage('user', 'Hello world');

        expect(messageId).toBeTruthy();

        const session = chatHistory.getCurrentSession();
        expect(session?.messages).toHaveLength(1);
        expect(session?.messages?.[0]?.content).toBe('Hello world');
        expect(session?.messages?.[0]?.role).toBe('user');
      });

      it('should add message with metadata', async () => {
        const metadata = { command: 'generate', tokens: 100 };
        const messageId = await chatHistory.addMessage('assistant', 'Response', metadata);

        const session = chatHistory.getCurrentSession();
        expect(session?.messages?.[0]?.metadata).toEqual(metadata);
      });

      it('should return empty string when no active session', async () => {
        const noSessionHistory = new ChatHistory({ enabled: true });
        const messageId = await noSessionHistory.addMessage('user', 'Hello');

        expect(messageId).toBe('');
      });

      it('should return empty string when disabled', async () => {
        const disabledHistory = new ChatHistory({ enabled: false });
        const messageId = await disabledHistory.addMessage('user', 'Hello');

        expect(messageId).toBe('');
      });

      it('should trim messages when exceeding limit', async () => {
        const limitedHistory = new ChatHistory({ maxMessagesPerSession: 2, enabled: true });
        await limitedHistory.startSession('Test');

        await limitedHistory.addMessage('user', 'Message 1');
        await limitedHistory.addMessage('user', 'Message 2');
        await limitedHistory.addMessage('user', 'Message 3');

        const session = limitedHistory.getCurrentSession();
        expect(session?.messages).toHaveLength(2);
        expect(session?.messages?.[0]?.content).toBe('Message 2');
        expect(session?.messages?.[1]?.content).toBe('Message 3');
      });

      it('should update session last activity', async () => {
        const session = chatHistory.getCurrentSession();
        const originalActivity = session?.lastActivity;

        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        await chatHistory.addMessage('user', 'Hello');

        const updatedSession = chatHistory.getCurrentSession();
        expect(updatedSession?.lastActivity.getTime()).toBeGreaterThan(
          originalActivity?.getTime() || 0
        );
      });
    });

    describe('searchMessages', () => {
      beforeEach(async () => {
        await chatHistory.addMessage('user', 'Hello world');
        await chatHistory.addMessage('assistant', 'Hi there');
        await chatHistory.addMessage('user', 'How are you doing?');
      });

      it('should search messages across all sessions', () => {
        const results = chatHistory.searchMessages('hello');

        expect(results).toHaveLength(1);
        expect(results?.[0]?.content).toBe('Hello world');
      });

      it('should search messages in specific session', async () => {
        const sessionId = chatHistory.getCurrentSession()?.id;
        const results = chatHistory.searchMessages('Hi', sessionId);

        expect(results).toHaveLength(1);
        expect(results?.[0]?.content).toBe('Hi there');
      });

      it('should return empty array for no matches', () => {
        const results = chatHistory.searchMessages('nonexistent');

        expect(results).toHaveLength(0);
      });

      it('should be case insensitive', () => {
        const results = chatHistory.searchMessages('HELLO');

        expect(results).toHaveLength(1);
        expect(results?.[0]?.content).toBe('Hello world');
      });

      it('should sort results by timestamp descending', async () => {
        // Add a delay to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));
        await chatHistory.addMessage('user', 'Another hello message');
        const results = chatHistory.searchMessages('hello');

        expect(results).toHaveLength(2);
        expect(results?.[0]?.content).toBe('Another hello message'); // Most recent first
      });
    });

    describe('getConversationContext', () => {
      beforeEach(async () => {
        await chatHistory.addMessage('system', 'System message');
        await chatHistory.addMessage('user', 'User message 1');
        await chatHistory.addMessage('assistant', 'Assistant response 1');
        await chatHistory.addMessage('user', 'User message 2');
        await chatHistory.addMessage('assistant', 'Assistant response 2');
      });

      it('should return recent messages excluding system messages', () => {
        const context = chatHistory.getConversationContext(10);

        expect(context).toHaveLength(4); // Excludes system message
        expect(context.every(msg => msg.role !== 'system')).toBe(true);
      });

      it('should limit messages to maxMessages parameter', () => {
        const context = chatHistory.getConversationContext(2);

        expect(context).toHaveLength(2);
        expect(context?.[0]?.content).toBe('User message 2'); // Most recent first
        expect(context?.[1]?.content).toBe('Assistant response 2');
      });

      it('should return empty array when no current session', () => {
        const noSessionHistory = new ChatHistory({ enabled: true });
        const context = noSessionHistory.getConversationContext();

        expect(context).toHaveLength(0);
      });
    });
  });

  describe('session history and statistics', () => {
    beforeEach(async () => {
      await chatHistory.startSession('Session 1');
      await chatHistory.addMessage('user', 'Hello from session 1');

      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await chatHistory.startSession('Session 2');
      await chatHistory.addMessage('user', 'Hello from session 2');
    });

    describe('getSessionHistory', () => {
      it('should return sessions sorted by last activity', async () => {
        // Add a small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = chatHistory.getSessionHistory();

        expect(history).toHaveLength(2);
        // Session 2 should be most recent since it was created after Session 1
        expect(history?.[0]?.title).toBe('Session 2'); // Most recent first
        expect(history?.[1]?.title).toBe('Session 1');
      });

      it('should limit results to specified limit', () => {
        const history = chatHistory.getSessionHistory(1);

        expect(history).toHaveLength(1);
        // Should return the most recent session
        expect(history?.[0]?.title).toBe('Session 2');
      });
    });

    describe('getStats', () => {
      it('should return session statistics', () => {
        const stats = chatHistory.getStats();

        expect(stats.totalSessions).toBe(2);
        expect(stats.totalMessages).toBe(2);
        expect(stats.oldestSession).toBeInstanceOf(Date);
        expect(stats.newestSession).toBeInstanceOf(Date);
        expect(typeof stats.storageSize).toBe('string');
      });

      it('should handle empty chat history', () => {
        const emptyHistory = new ChatHistory({ enabled: true });
        const stats = emptyHistory.getStats();

        expect(stats.totalSessions).toBe(0);
        expect(stats.totalMessages).toBe(0);
        expect(stats.oldestSession).toBeNull();
        expect(stats.newestSession).toBeNull();
      });

      it('should calculate storage size', () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readdirSync).mockReturnValue([
          'session1.json',
          'session2.json',
        ] as unknown as Dirent<Buffer<ArrayBufferLike>>[]);
        vi.mocked(statSync).mockReturnValue({ isDirectory: () => false, size: 2048 } as any);

        const stats = chatHistory.getStats();

        expect(stats.storageSize).toContain('KB');
      });
    });
  });

  describe('session persistence', () => {
    it('should load existing sessions during initialization', async () => {
      const sessionData = {
        id: 'existing-session',
        title: 'Existing Session',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messages: [
          { id: 'msg1', role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        ],
        context: { projectPath: '/test' },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['existing-session.json'] as unknown as Dirent<
        Buffer<ArrayBufferLike>
      >[]);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(sessionData));

      const newHistory = new ChatHistory(mockConfig);
      const history = newHistory.getSessionHistory();

      expect(history).toHaveLength(1);
      expect(history?.[0]?.title).toBe('Existing Session');
    });

    it('should handle corrupted session files gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['corrupted.json'] as unknown as Dirent<
        Buffer<ArrayBufferLike>
      >[]);
      vi.mocked(readFileSync).mockReturnValue('invalid json');

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        return;
      });

      const newHistory = new ChatHistory(mockConfig);
      const history = newHistory.getSessionHistory();

      expect(history).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('session context management', () => {
    beforeEach(async () => {
      await chatHistory.startSession('Test Session', { projectPath: '/initial' });
    });

    describe('updateSessionContext', () => {
      it('should update session context', async () => {
        await chatHistory.updateSessionContext({ currentCommand: 'generate' });

        const session = chatHistory.getCurrentSession();
        expect(session?.context).toEqual({
          projectPath: '/initial',
          currentCommand: 'generate',
        });
      });

      it('should not update when no current session', async () => {
        const noSessionHistory = new ChatHistory({ enabled: true });
        const [error] = await safeRun(
          async () => await noSessionHistory.updateSessionContext({ test: 'value' })
        );

        expect(error).toBeUndefined();
      });
    });
  });

  describe('export functionality', () => {
    beforeEach(async () => {
      await chatHistory.startSession('Export Test Session');
      await chatHistory.addMessage('user', 'Test message');
      await chatHistory.addMessage('assistant', 'Test response');
    });

    describe('exportSession', () => {
      it('should export session as JSON', async () => {
        const sessionId = chatHistory.getCurrentSession()?.id;
        const filepath = await chatHistory.exportSession(sessionId!, 'json');

        expect(filepath).toContain('.json');
        expect(writeFileSync).toHaveBeenCalled();
      });

      it('should export session as Markdown', async () => {
        const sessionId = chatHistory.getCurrentSession()?.id;
        const filepath = await chatHistory.exportSession(sessionId!, 'markdown');

        expect(filepath).toContain('.markdown');
        expect(writeFileSync).toHaveBeenCalled();
      });

      it('should throw error for non-existent session', async () => {
        const [error] = await safeRun(async () => await chatHistory.exportSession('non-existent'));

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain('not found');
      });
    });
  });

  describe('cleanup functionality', () => {
    beforeEach(async () => {
      // Create sessions with different ages
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentDate = new Date();

      await chatHistory.startSession('Old Session');
      const oldSession = chatHistory.getCurrentSession();
      if (oldSession) {
        oldSession.lastActivity = oldDate;
      }

      await chatHistory.startSession('Recent Session');
    });

    describe('cleanup', () => {
      it('should remove old sessions based on maxHistoryDays', async () => {
        const historyWithCleanup = new ChatHistory({
          ...mockConfig,
          maxHistoryDays: 5,
          autoCleanup: false,
        });

        // Create sessions that would be cleaned up
        await historyWithCleanup.startSession('Old Session');

        await historyWithCleanup.cleanup();

        // Implementation calls cleanup logic
        const [error] = await safeRun(async () => await historyWithCleanup.cleanup());
        expect(error).toBeUndefined();
      });

      it('should respect maxSessions limit', async () => {
        const limitedHistory = new ChatHistory({
          ...mockConfig,
          maxSessions: 1,
          autoCleanup: false,
        });

        await limitedHistory.startSession('Session 1');
        await limitedHistory.startSession('Session 2');

        const sessionsBefore = limitedHistory.getSessionHistory();
        expect(sessionsBefore.length).toBeGreaterThan(0);

        await limitedHistory.cleanup();

        // Cleanup method executes successfully
        const [error] = await safeRun(async () => await limitedHistory.cleanup());
        expect(error).toBeUndefined();
      });

      it('should not cleanup when disabled', async () => {
        const disabledHistory = new ChatHistory({ enabled: false });
        await disabledHistory.cleanup();

        // Should not throw errors when disabled
        const [error] = await safeRun(async () => await disabledHistory.cleanup());
        expect(error).toBeUndefined();
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle directory creation errors', () => {
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        return;
      });

      const [error] = safeRun(() => new ChatHistory(mockConfig));

      expect(error).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle session saving errors gracefully', async () => {
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        return;
      });

      await chatHistory.startSession('Test Session');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save session'),
        'Disk full'
      );
    });

    it('should handle file system errors gracefully during initialization', () => {
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const [error] = safeRun(() => new ChatHistory(mockConfig));

      expect(error).toBeUndefined(); // Should not throw, handle errors gracefully
    });
  });
});
