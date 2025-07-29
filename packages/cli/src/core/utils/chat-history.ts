/**
 * @fileoverview Chat History Manager - Local conversation persistence
 * Stores AI conversation history locally for context and resumption
 */

import * as fs from 'fs';
import * as path from 'path';
import { Performance } from './performance';

/**
 * @llm-summary Contract for chat message functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ChatMessage interface implementing infrastructure service for chat message operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteChatMessage implements ChatMessage {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    command?: string;
    tokens?: number;
    model?: string;
    duration?: number;
    [key: string]: unknown;
  };
}

/**
 * @llm-summary Contract for chat session functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ChatSession interface implementing infrastructure service for chat session operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteChatSession implements ChatSession {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ChatSession {
  id: string;
  title: string;
  startedAt: Date;
  lastActivity: Date;
  messages: ChatMessage[];
  context?: {
    projectPath?: string;
    currentCommand?: string;
    workingDirectory?: string;
    [key: string]: unknown;
  };
}

/**
 * @llm-summary Contract for chat history config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ChatHistoryConfig interface implementing infrastructure service for chat history config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteChatHistoryConfig implements ChatHistoryConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ChatHistoryConfig {
  enabled: boolean;
  maxSessions: number;
  maxMessagesPerSession: number;
  maxHistoryDays: number;
  storageDir: string;
  autoCleanup: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ChatHistoryConfig = {
  enabled: !process.env.CI, // Disable chat history in CI environments
  maxSessions: 100,
  maxMessagesPerSession: 1000,
  maxHistoryDays: 30,
  storageDir: path.join(process.cwd(), '.vytches-ddd', 'chat-history'),
  autoCleanup: true,
};

/**
 * @llm-summary ChatHistory class for chat history operations
 * @llm-domain Infrastructure
 * @llm-complexity Simple
 *
 * @description
 * ChatHistory class implementing infrastructure service for chat history operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ChatHistory();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ChatHistory {
  private config: ChatHistoryConfig;
  private currentSession: ChatSession | null = null;
  private sessions = new Map<string, ChatSession>();

  constructor(config: Partial<ChatHistoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  /**
   * Initialize chat history storage
   */
  private async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Ensure storage directory exists
      if (!fs.existsSync(this.config.storageDir)) {
        fs.mkdirSync(this.config.storageDir, { recursive: true });
      }

      // Load existing sessions
      await this.loadSessions();

      // Auto cleanup if enabled
      if (this.config.autoCleanup) {
        await this.cleanup();
      }
    } catch (error) {
      console.warn(
        'Failed to initialize chat history:',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Start a new chat session
   */
  async startSession(title?: string, context?: ChatSession['context']): Promise<string> {
    if (!this.config.enabled) return '';

    const sessionId = this.generateSessionId();
    const session: ChatSession = {
      id: sessionId,
      title: title || `Chat Session ${new Date().toLocaleString()}`,
      startedAt: new Date(),
      lastActivity: new Date(),
      messages: [],
      context: context || {},
    };

    this.currentSession = session;
    this.sessions.set(sessionId, session);

    await this.saveSession(session);
    return sessionId;
  }

  /**
   * Resume existing session
   */
  async resumeSession(sessionId: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    const session = this.sessions.get(sessionId);
    if (!session) {
      // Try to load from disk
      const loaded = await this.loadSession(sessionId);
      if (!loaded) return false;
    }

    this.currentSession = this.sessions.get(sessionId) || null;
    return this.currentSession !== null;
  }

  /**
   * Add message to current session
   */
  async addMessage(
    role: ChatMessage['role'],
    content: string,
    metadata?: ChatMessage['metadata']
  ): Promise<string> {
    if (!this.config.enabled || !this.currentSession) return '';

    const messageId = this.generateMessageId();
    const message: ChatMessage = {
      id: messageId,
      role,
      content,
      timestamp: new Date(),
      metadata: metadata || {},
    };

    this.currentSession.messages.push(message);
    this.currentSession.lastActivity = new Date();

    // Trim messages if exceeding limit
    if (this.currentSession.messages.length > this.config.maxMessagesPerSession) {
      this.currentSession.messages = this.currentSession.messages.slice(
        -this.config.maxMessagesPerSession
      );
    }

    await this.saveSession(this.currentSession);
    return messageId;
  }

  /**
   * Get current session
   */
  getCurrentSession(): ChatSession | null {
    return this.currentSession;
  }

  /**
   * Get session history
   */
  getSessionHistory(limit = 10): ChatSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
      .slice(0, limit);
  }

  /**
   * Search messages across sessions
   */
  searchMessages(query: string, sessionId?: string): ChatMessage[] {
    const results: ChatMessage[] = [];
    const searchTerm = query.toLowerCase();

    const sessionsToSearch = sessionId
      ? [this.sessions.get(sessionId)].filter(Boolean)
      : Array.from(this.sessions.values());

    for (const session of sessionsToSearch) {
      if (!session) continue;

      for (const message of session.messages) {
        if (message.content.toLowerCase().includes(searchTerm)) {
          results.push(message);
        }
      }
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Export session to file
   */
  async exportSession(sessionId: string, format: 'json' | 'markdown' = 'json'): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `chat-export-${sessionId}-${timestamp}.${format}`;
    const filepath = path.join(this.config.storageDir, 'exports', filename);
    const exportDir = path.dirname(filepath);

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    let content: string;
    if (format === 'markdown') {
      content = this.sessionToMarkdown(session);
    } else {
      content = JSON.stringify(session, null, 2);
    }

    fs.writeFileSync(filepath, content, 'utf-8');
    return filepath;
  }

  /**
   * Get conversation context for AI
   */
  getConversationContext(maxMessages = 20): ChatMessage[] {
    if (!this.currentSession) return [];

    return this.currentSession.messages.slice(-maxMessages).filter(msg => msg.role !== 'system');
  }

  /**
   * Update session context
   */
  async updateSessionContext(context: Partial<ChatSession['context']>): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.context = {
      ...this.currentSession.context,
      ...context,
    };

    await this.saveSession(this.currentSession);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);

    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }

    const filepath = this.getSessionFilePath(sessionId);
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup old sessions
   */
  async cleanup(): Promise<void> {
    if (!this.config.enabled) return;

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - this.config.maxHistoryDays * 24 * 60 * 60 * 1000);

    const sessionsToDelete: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (session.lastActivity < cutoffDate) {
        sessionsToDelete.push(sessionId);
      }
    }

    // Keep only the most recent sessions if exceeding max
    const sessionsByActivity = Array.from(this.sessions.values()).sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
    );

    if (sessionsByActivity.length > this.config.maxSessions) {
      const excessSessions = sessionsByActivity.slice(this.config.maxSessions);
      sessionsToDelete.push(...excessSessions.map(s => s.id));
    }

    // Delete old sessions
    for (const sessionId of sessionsToDelete) {
      await this.deleteSession(sessionId);
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalSessions: number;
    totalMessages: number;
    oldestSession: Date | null;
    newestSession: Date | null;
    storageSize: string;
  } {
    const sessions = Array.from(this.sessions.values());
    const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0);

    const dates = sessions.map(s => s.startedAt).sort();
    const oldest = dates.length > 0 ? dates[0] : null;
    const newest = dates.length > 0 ? dates[dates.length - 1] : null;

    // Calculate storage size
    let storageSize = '0 B';
    try {
      if (fs.existsSync(this.config.storageDir)) {
        const stats = this.getDirectorySize(this.config.storageDir);
        storageSize = this.formatBytes(stats);
      }
    } catch {
      // Ignore errors
    }

    return {
      totalSessions: sessions.length,
      totalMessages,
      oldestSession: oldest || null,
      newestSession: newest || null,
      storageSize,
    };
  }

  /**
   * Private helper methods
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.config.storageDir, 'sessions', `${sessionId}.json`);
  }

  private async loadSessions(): Promise<void> {
    const sessionsDir = path.join(this.config.storageDir, 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(sessionsDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionId = file.replace('.json', '');
        await this.loadSession(sessionId);
      }
    }
  }

  private async loadSession(sessionId: string): Promise<boolean> {
    const filepath = this.getSessionFilePath(sessionId);

    try {
      if (!fs.existsSync(filepath)) return false;

      const content = fs.readFileSync(filepath, 'utf-8');
      const session: ChatSession = JSON.parse(content);

      // Convert date strings back to Date objects
      session.startedAt = new Date(session.startedAt);
      session.lastActivity = new Date(session.lastActivity);
      session.messages.forEach(msg => {
        msg.timestamp = new Date(msg.timestamp);
      });

      this.sessions.set(sessionId, session);
      return true;
    } catch (error) {
      console.warn(
        `Failed to load session ${sessionId}:`,
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  private async saveSession(session: ChatSession): Promise<void> {
    const filepath = this.getSessionFilePath(session.id);

    try {
      const sessionDir = path.dirname(filepath);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      fs.writeFileSync(filepath, JSON.stringify(session, null, 2), 'utf-8');
    } catch (error) {
      console.warn(
        `Failed to save session ${session.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  private sessionToMarkdown(session: ChatSession): string {
    let markdown = `# ${session.title}\n\n`;
    markdown += `**Started:** ${session.startedAt.toLocaleString()}\n`;
    markdown += `**Last Activity:** ${session.lastActivity.toLocaleString()}\n`;
    markdown += `**Messages:** ${session.messages.length}\n\n`;

    if (session.context) {
      markdown += `## Context\n\n`;
      for (const [key, value] of Object.entries(session.context)) {
        markdown += `- **${key}:** ${value}\n`;
      }
      markdown += '\n';
    }

    markdown += `## Conversation\n\n`;

    for (const message of session.messages) {
      const roleIcon = message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️';
      markdown += `### ${roleIcon} ${message.role.charAt(0).toUpperCase() + message.role.slice(1)}\n`;
      markdown += `*${message.timestamp.toLocaleString()}*\n\n`;
      markdown += `${message.content}\n\n`;

      if (message.metadata) {
        markdown += `<details><summary>Metadata</summary>\n\n`;
        markdown += '```json\n';
        markdown += JSON.stringify(message.metadata, null, 2);
        markdown += '\n```\n\n</details>\n\n';
      }
    }

    return markdown;
  }

  private getDirectorySize(dirPath: string): number {
    let size = 0;

    try {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filepath = path.join(dirPath, file);
        const stats = fs.statSync(filepath);

        if (stats.isDirectory()) {
          size += this.getDirectorySize(filepath);
        } else {
          size += stats.size;
        }
      }
    } catch {
      // Ignore errors
    }

    return size;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

/**
 * @llm-summary chatHistory constant
 * @llm-domain Infrastructure
 *
 * @description
 * chatHistory constant implementing infrastructure service for chat history operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(chatHistory);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const chatHistory = new ChatHistory();
